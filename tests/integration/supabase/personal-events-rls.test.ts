// Story 031 (ADR-0004): applies all migrations on in-memory Postgres (PGlite) and checks, as the
// `authenticated` and `anon` roles, the `personal_events` table: owner-only read/write, consent
// version gate, no update/delete, server-assigned sync_seq, CHECK constraints and cascade delete.
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import ACCOUNTS_SQL from '../../../supabase/migrations/20261106000000_accounts.sql?raw';
import HOUSEHOLDS_SQL from '../../../supabase/migrations/20261107000000_households.sql?raw';
import SYNC_SQL from '../../../supabase/migrations/20261107010000_contact_sync_seq.sql?raw';
import GROUP_SQL from '../../../supabase/migrations/20261109000000_group_activity_cheers.sql?raw';
import PERSONAL_SQL from '../../../supabase/migrations/20261118000000_personal_events.sql?raw';

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
const E = (n: number) => `40000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const RLS = /row-level security/;

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

async function asAnon<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
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

/** Inserts a personal event as user n (user_id defaults to auth.uid() unless given). Returns the new id. */
async function add(
  n: number,
  type: string,
  payload: Record<string, unknown> = {},
  extra: { userId?: string; syncSeq?: number; id?: string } = {},
): Promise<string> {
  const id = extra.id ?? E(++eventSeq);
  await as(n, () =>
    db.query(
      `insert into public.personal_events (id, user_id, type, occurred_at, payload, sync_seq)
       values ($1, coalesce($2::uuid, auth.uid()), $3, now(), $4, $5)`,
      [id, extra.userId ?? null, type, JSON.stringify(payload), extra.syncSeq ?? null],
    ),
  );
  return id;
}

const lessonDone = { lessonId: 'l1', xp: 10 };
const countAs = (n: number) => as(n, () => one<number>('select count(*)::int as v from public.personal_events'));
const countAll = () => one<number>('select count(*)::int as v from public.personal_events');
const seqOf = (id: string) => one<string>('select sync_seq::text as v from public.personal_events where id = $1', [id]);

// Users: 1 admin; 2 owner (root household A); 3 same household as 2 (member); 4 sponsor of A's household
// is user 7 (root); 5 downline (F1 of A); 6 unrelated root; 8 owner without consent.
let A: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(ACCOUNTS_SQL);
  await db.query('insert into auth.users values ($1, $2)', [U(1), 'u1']);
  await db.query(`insert into public.profiles (id, phone, role, must_change_password) values ($1, '+84948161365', 'admin', false)`, [U(1)]);
  await db.exec(HOUSEHOLDS_SQL);
  await db.exec(SYNC_SQL);
  await db.exec(GROUP_SQL);
  await db.exec(PERSONAL_SQL);
  await db.exec('grant all on all tables in schema public to service_role;');
  const S = await provision(7, null, '2000007', 1); // sponsor (upline) of A
  A = await provision(2, S, '2000002', 7);
  await provision(5, A, '2000005', 2); // downline
  await provision(6, null, '2000006', 1); // unrelated
  await provision(8, null, '2000008', 1); // never consents
  // user 3 joins A's household (moved there as the database owner, as a code join would)
  await provision(3, S, '2000003', 7);
  await db.query('update public.household_members set household_id = $1 where user_id = $2', [A, U(3)]);
  await db.query('insert into public.contact_consents (user_id, version) select id, 1 from public.profiles where id <> $1', [U(8)]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('owner access and sync_seq', () => {
  it('lets the owner insert and read their own row, with sync_seq assigned by the server', async () => {
    const id = await add(2, 'lesson_completed', lessonDone);
    expect(await countAs(2)).toBe(1);
    expect(Number(await seqOf(id))).toBeGreaterThan(0);
  });

  it('ignores a sync_seq sent by the client', async () => {
    const id = await add(2, 'lesson_completed', lessonDone, { syncSeq: 999_999 });
    expect(await seqOf(id)).not.toBe('999999');
  });

  it('gives two inserts different, increasing sync_seq values', async () => {
    const a = await add(2, 'lesson_completed', lessonDone);
    const b = await add(2, 'lesson_completed', lessonDone);
    expect(Number(await seqOf(b))).toBeGreaterThan(Number(await seqOf(a)));
  });

  it('adds no row when the same id is sent again with on conflict (id) do nothing', async () => {
    const id = await add(2, 'lesson_completed', lessonDone);
    const before = await countAll();
    await as(2, () =>
      db.query(
        `insert into public.personal_events (id, type, occurred_at, payload) values ($1, 'lesson_completed', now(), '{}') on conflict (id) do nothing`,
        [id],
      ),
    );
    expect(await countAll()).toBe(before);
  });
});

describe('nobody but the owner', () => {
  it.each([
    ['a member of the same household', 3],
    ['a sponsor (upline)', 7],
    ['a downline member', 5],
    ['an unrelated user', 6],
    ['an admin through the app role', 1],
  ])('sees 0 rows of the owner for %s', async (_label, n) => {
    expect(await countAll()).toBeGreaterThan(0);
    expect(await countAs(n)).toBe(0);
  });

  it('is refused for anon on select', async () => {
    await expect(asAnon(() => db.query('select * from public.personal_events'))).rejects.toThrow(/permission denied/);
  });

  it('refuses an insert with another user_id with an RLS error, for every other kind of user', async () => {
    for (const n of [3, 7, 5, 6, 1]) {
      await expect(add(n, 'lesson_completed', lessonDone, { userId: U(2) })).rejects.toThrow(RLS);
    }
  });

  it('refuses an insert from anon', async () => {
    await expect(
      asAnon(() => db.query(`insert into public.personal_events (id, user_id, type, occurred_at) values ($1, $2, 'lesson_completed', now())`, [E(900), U(2)])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('consent version', () => {
  it('refuses an insert with an RLS error when the account has no consent row', async () => {
    await expect(add(8, 'lesson_completed', lessonDone)).rejects.toThrow(RLS);
  });

  it('refuses an insert when the consented version is below the server version, and accepts it after consenting again', async () => {
    await db.query(`update public.app_config set value = '2' where key = 'contact_consent_version'`);
    try {
      await expect(add(6, 'lesson_completed', lessonDone)).rejects.toThrow(RLS);
      await as(6, () => db.query('select public.record_contact_consent(2)'));
      await add(6, 'lesson_completed', lessonDone);
      expect(await countAs(6)).toBe(1);
    } finally {
      await db.query(`update public.app_config set value = '1' where key = 'contact_consent_version'`);
    }
  });

  it('accepts an insert once a consent row at the current version exists', async () => {
    await as(8, () => db.query('select public.record_contact_consent(1)'));
    await add(8, 'lesson_completed', lessonDone);
    expect(await countAs(8)).toBe(1);
  });

  it('does not let the app role call the consent version function directly', async () => {
    await as(2, () => expect(db.query('select public.contact_consent_version()')).rejects.toThrow(/permission denied/));
  });
});

describe('no update or delete', () => {
  it('refuses an update by the owner with permission denied', async () => {
    await as(2, () => expect(db.query(`update public.personal_events set type = 'lesson_completed'`)).rejects.toThrow(/permission denied/));
  });

  it('refuses a delete by the owner with permission denied, and the rows stay', async () => {
    const before = await countAll();
    await as(2, () => expect(db.query('delete from public.personal_events')).rejects.toThrow(/permission denied/));
    expect(await countAll()).toBe(before);
  });
});

describe('check constraints', () => {
  it('rejects an unknown type (person_added)', async () => {
    await expect(add(2, 'person_added', { personId: 'p1' })).rejects.toThrow(/personal_events_type_check/);
  });

  it('rejects activity_logged that carries a personId', async () => {
    await expect(add(2, 'activity_logged', { personId: 'p1', activityType: 'follow_up' })).rejects.toThrow(/personal_events_activity_not_contact/);
  });

  it('accepts activity_logged without a personId, and the compensating form', async () => {
    await add(2, 'activity_logged', { activityType: 'study' });
    await add(2, 'activity_logged', { compensates: 'x' });
  });

  it.each([
    ['reminder', { reminder: { hour: 8 } }],
    ['sound', { sound: { on: true } }],
    ['dailyGoal', { dailyGoal: 30 }],
    ['accountLinked', { accountLinked: { at: 'x' } }],
    ['contactSync', { contactSync: { at: 'x' } }],
  ])('rejects settings_changed carrying only %s', async (_k, payload) => {
    await expect(add(2, 'settings_changed', payload)).rejects.toThrow(/personal_events_settings_progress_only/);
  });

  it.each([
    ['achievementAcknowledged', { achievementAcknowledged: 'a1' }],
    ['stageAcknowledged', { stageAcknowledged: 's1' }],
    ['achievementsSeeded', { achievementsSeeded: true }],
  ])('accepts settings_changed carrying %s', async (_k, payload) => {
    await add(2, 'settings_changed', payload);
  });

  it('accepts lesson_completed', async () => {
    await add(2, 'lesson_completed', lessonDone);
  });

  it('rejects a payload that is not a JSON object', async () => {
    await as(2, () =>
      expect(
        db.query(`insert into public.personal_events (id, type, occurred_at, payload) values ($1, 'lesson_completed', now(), '[]')`, [E(901)]),
      ).rejects.toThrow(/payload_check|check constraint/),
    );
  });
});

describe('account deletion', () => {
  it('removes the rows of a deleted profile (cascade) and leaves other users rows', async () => {
    await add(5, 'lesson_completed', lessonDone);
    const mine = () => one<number>('select count(*)::int as v from public.personal_events where user_id = $1', [U(5)]);
    expect(await mine()).toBeGreaterThan(0);
    const others = await one<number>('select count(*)::int as v from public.personal_events where user_id <> $1', [U(5)]);
    await db.query('delete from auth.users where id = $1', [U(5)]);
    await db.query('delete from public.profiles where id = $1', [U(5)]);
    expect(await mine()).toBe(0);
    expect(await countAll()).toBe(others);
  });
});
