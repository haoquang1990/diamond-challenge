// Story 028: applies all migrations on in-memory Postgres (PGlite) and checks, as the
// `authenticated` role, the last-activity stamp (and that sync_seq still works) and the
// `cheers` table: direct sponsor only, one per day, readable by sender and receiver only.
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import ACCOUNTS_SQL from '../../../supabase/migrations/20261106000000_accounts.sql?raw';
import HOUSEHOLDS_SQL from '../../../supabase/migrations/20261107000000_households.sql?raw';
import SYNC_SQL from '../../../supabase/migrations/20261107010000_contact_sync_seq.sql?raw';
import GROUP_SQL from '../../../supabase/migrations/20261109000000_group_activity_cheers.sql?raw';

const SUPABASE_STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

const U = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const E = (n: number) => `30000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

let db: PGlite;
let eventSeq = 0;

async function as<T>(n: number, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${U(n)}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query<{ v: T }>(sql, params);
  return rows[0]?.v as T;
}

/** Provisions user n in a new household sponsored by `sponsor` (null = root), as the Edge Function would. */
async function provision(n: number, sponsor: string | null, code: string, by: number): Promise<string> {
  await db.query('insert into auth.users values ($1, $2)', [U(n), `u${n}`]);
  await db.exec('set role service_role;');
  try {
    return await one<string>('select public.provision_household($1, $2, $3, $4, $5, $6) as v', [
      U(n), `+849000000${String(n).padStart(2, '0')}`, sponsor, code, U(by), `User ${n}`,
    ]);
  } finally {
    await db.exec('reset role;');
  }
}

async function addEvent(n: number, h: string, type: string, payload: Record<string, unknown>): Promise<void> {
  await as(n, () =>
    db.query(
      `insert into public.contact_events (id, household_id, author_id, type, occurred_at, payload) values ($1, $2, $3, $4, now(), $5)`,
      [E(++eventSeq), h, U(n), type, JSON.stringify(payload)],
    ),
  );
}

const cheer = (n: number, from: string, to: string, message = 'Cố lên!') =>
  as(n, () => db.query('insert into public.cheers (from_household_id, to_household_id, message) values ($1, $2, $3)', [from, to, message]));

const lastActivity = (h: string) =>
  one<string | null>('select last_activity_at::text as v from public.households where id = $1', [h]);

// Tree: A (user 2, root) -> B (user 3) -> C (user 4); A -> D (user 5); user 6 is unrelated root.
let A: string, B: string, C: string, D: string, X: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(ACCOUNTS_SQL);
  await db.query('insert into auth.users values ($1, $2)', [U(1), 'u1']);
  await db.query(`insert into public.profiles (id, phone, role, must_change_password) values ($1, '+84948161365', 'admin', false)`, [U(1)]);
  await db.exec(HOUSEHOLDS_SQL);
  await db.exec(SYNC_SQL);
  await db.exec(GROUP_SQL);
  await db.exec('grant all on all tables in schema public to service_role;');
  A = await provision(2, null, '2000002', 1);
  B = await provision(3, A, '2000003', 2);
  C = await provision(4, B, '2000004', 3);
  D = await provision(5, A, '2000005', 2);
  X = await provision(6, null, '2000006', 1);
  await db.query('insert into public.contact_consents (user_id, version) select id, 1 from public.profiles');
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('last_activity_at', () => {
  it('is empty until an activity is logged, then set by the server and visible to the sponsor', async () => {
    expect(await lastActivity(B)).toBeNull();
    await addEvent(3, B, 'person_added', { personId: 'p1', name: 'Khách' });
    expect(await lastActivity(B)).toBeNull();
    await addEvent(3, B, 'activity_logged', { personId: 'p1', activityType: 'follow_up' });
    expect(await lastActivity(B)).not.toBeNull();
    const seen = await as(2, () => one<string | null>('select last_activity_at::text as v from public.households where id = $1', [B]));
    expect(seen).not.toBeNull();
  });

  it('is not stamped by a compensation, and sync_seq is still assigned', async () => {
    await addEvent(5, D, 'activity_logged', { compensates: E(999) });
    expect(await lastActivity(D)).toBeNull();
    const seqs = await one<number>(`select count(distinct sync_seq)::int as v from public.contact_events where household_id = $1`, [B]);
    expect(seqs).toBe(2);
  });

  it('cannot be written by an app user', async () => {
    await as(3, () =>
      expect(db.query(`update public.households set last_activity_at = null where id = $1`, [B])).rejects.toThrow(),
    );
    expect(await lastActivity(B)).not.toBeNull();
  });
});

describe('cheers', () => {
  it('refuses a cheer from a non-sponsor: deeper upline, downline, unrelated, or a non-member', async () => {
    await expect(cheer(2, A, C)).rejects.toThrow(/row-level security/);
    await expect(cheer(4, C, A)).rejects.toThrow(/row-level security/);
    await expect(cheer(3, B, A)).rejects.toThrow(/row-level security/);
    await expect(cheer(6, X, B)).rejects.toThrow(/row-level security/);
    await expect(cheer(6, A, D)).rejects.toThrow(/row-level security/);
  });

  it('lets a member of the direct sponsor household cheer an F1 household', async () => {
    await cheer(2, A, B);
    expect(await one<number>('select count(*)::int as v from public.cheers')).toBe(1);
  });

  it('refuses a second cheer the same day for the same pair, at the database', async () => {
    await expect(cheer(2, A, B)).rejects.toThrow(/already received/);
    await cheer(2, A, D);
    expect(await one<number>('select count(*)::int as v from public.cheers')).toBe(2);
  });

  it('refuses a non-sponsor with an RLS error even when the pair was already cheered today', async () => {
    // The daily-limit check must not tell an outsider whether a household got a cheer today.
    await expect(cheer(6, A, B)).rejects.toThrow(/row-level security/);
    await expect(cheer(5, A, B)).rejects.toThrow(/row-level security/);
  });

  it('reads only for the sending and the receiving household', async () => {
    const visible = (n: number) => as(n, () => one<number>('select count(*)::int as v from public.cheers'));
    expect(await visible(2)).toBe(2);
    expect(await visible(3)).toBe(1);
    expect(await visible(5)).toBe(1);
    expect(await visible(4)).toBe(0);
    expect(await visible(6)).toBe(0);
  });

  it('cannot be updated or deleted by app users', async () => {
    await as(2, async () => {
      await expect(db.query(`update public.cheers set message = 'x'`)).rejects.toThrow(/permission denied/);
      await expect(db.query('delete from public.cheers')).rejects.toThrow(/permission denied/);
    });
    expect(await one<number>('select count(*)::int as v from public.cheers')).toBe(2);
  });

  it('does not let a downline read its sponsor household, its code or its numbers', async () => {
    await as(3, async () => {
      expect(await one<number>('select count(*)::int as v from public.households where id = $1', [A])).toBe(0);
      expect(await one<number>('select count(*)::int as v from public.household_codes where household_id = $1', [A])).toBe(0);
      expect(await one<number>('select count(*)::int as v from public.household_aggregates where household_id = $1', [A])).toBe(0);
    });
  });
});
