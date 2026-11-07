// ADR-0002 amendment (architecture review 2026-11-07): the household contact book is pulled by
// a server-assigned `sync_seq`, not `created_at`. Applies the three migrations on in-memory
// Postgres (PGlite), loading events BEFORE the sync migration to check the backfill, then
// checks that a device cursor still sees events that change household, and that the
// phase-2b code-merge functions are locked for app users.
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import ACCOUNTS_SQL from '../../../supabase/migrations/20261106000000_accounts.sql?raw';
import HOUSEHOLDS_SQL from '../../../supabase/migrations/20261107000000_households.sql?raw';
import SYNC_SQL from '../../../supabase/migrations/20261107010000_contact_sync_seq.sql?raw';

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
const E = (n: number) => `20000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

let db: PGlite;

/** Runs `fn` as the `authenticated` role signed in as user n. */
async function as<T>(n: number, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${U(n)}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}

/** Runs `fn` as the database owner with user n's id in the JWT (how a 2b admin path would run). */
async function asOwnerSignedInAs<T>(n: number, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${U(n)}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`select set_config('request.jwt.claim.sub', '', false);`);
  }
}

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query<{ v: T }>(sql, params);
  return rows[0]?.v as T;
}

/** Provisions user n in a new household, as the Edge Function would. */
async function provision(n: number, sponsor: string | null, code: string): Promise<string> {
  await db.query('insert into auth.users values ($1, $2)', [U(n), `u${n}`]);
  await db.exec('set role service_role;');
  try {
    return await one<string>('select public.provision_household($1, $2, $3, $4, $5) as v', [
      U(n), `+849000000${String(n).padStart(2, '0')}`, sponsor, code, U(1),
    ]);
  } finally {
    await db.exec('reset role;');
  }
}

/** Inserts a contact event as the table owner, with a chosen created_at. */
async function seed(id: number, household: string, createdAt: string, payload: Record<string, unknown>, type = 'person_added') {
  await db.query(
    `insert into public.contact_events (id, household_id, type, occurred_at, payload, created_at) values ($1, $2, $3, $4, $5, $4)`,
    [E(id), household, type, createdAt, JSON.stringify(payload)],
  );
}

const seqOf = (id: number) => one<number>('select sync_seq::int as v from public.contact_events where id = $1', [E(id)]);
const maxSeq = (h: string) =>
  one<number>('select coalesce(max(sync_seq), 0)::int as v from public.contact_events where household_id = $1', [h]);
const maxCreated = (h: string) =>
  one<string>('select max(created_at)::text as v from public.contact_events where household_id = $1', [h]);

/** Ids a device of household h pulls with a sync_seq cursor, as member n through RLS. */
const pullBySeq = (n: number, h: string, cursor: number) =>
  as(n, async () =>
    (await db.query<{ id: string }>(
      'select id from public.contact_events where household_id = $1 and sync_seq > $2 order by sync_seq', [h, cursor],
    )).rows.map((r) => r.id),
  );

/** Ids the old created_at cursor would pull. */
const pullByCreatedAt = (n: number, h: string, cursor: string) =>
  as(n, async () =>
    (await db.query<{ id: string }>(
      'select id from public.contact_events where household_id = $1 and created_at > $2', [h, cursor],
    )).rows.map((r) => r.id),
  );

let S2: string, HX: string, HY: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(ACCOUNTS_SQL);
  await db.query('insert into auth.users values ($1, $2)', [U(1), 'u1']);
  await db.query(`insert into public.profiles (id, phone, role, must_change_password) values ($1, '+84948161365', 'admin', false)`, [U(1)]);
  await db.exec(HOUSEHOLDS_SQL);
  await db.exec('grant all on all tables in schema public to service_role;');
  S2 = await provision(2, null, '1000002');
  HY = await provision(6, S2, '1000006');
  HX = await provision(8, S2, '1000008');
  // before the sync migration; S2's own event is the newest by created_at
  await seed(1, HY, '2026-01-01T00:00:00Z', { personId: 'k1', name: 'K', amwayCode: '3000001' });
  await seed(2, HY, '2026-01-02T00:00:00Z', { personId: 'k1', name: 'K2' }, 'person_updated');
  await seed(3, HX, '2026-02-01T00:00:00Z', { personId: 'x1', name: 'X' });
  await seed(4, S2, '2026-03-01T00:00:00Z', { personId: 's1', name: 'S' });
  await db.exec(SYNC_SQL);
  await db.exec('grant all on all tables in schema public to service_role;');
  for (const n of [2, 6, 8]) await as(n, () => db.query('select public.record_contact_consent(1)'));
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('sync_seq column', () => {
  it('numbers existing events in created_at order', async () => {
    expect([await seqOf(1), await seqOf(2), await seqOf(3), await seqOf(4)]).toEqual([1, 2, 3, 4]);
  });

  it('gives a new event the next number and ignores a number sent by the app', async () => {
    await as(2, () =>
      db.query(
        `insert into public.contact_events (id, household_id, author_id, type, occurred_at, payload, sync_seq)
         values ($1, $2, $3, 'person_added', now(), '{"personId":"s2","name":"S2"}', 1)`,
        [E(5), S2, U(2)],
      ),
    );
    expect(await seqOf(5)).toBe(5);
  });

  it('does not change the number when household_id stays the same', async () => {
    await db.query(`update public.contact_events set payload = payload || '{"note":"x"}' where id = $1`, [E(5)]);
    await db.query('update public.contact_events set household_id = household_id where id = $1', [E(5)]);
    expect(await seqOf(5)).toBe(5);
  });

  it('keeps the sequence away from app roles', async () => {
    await as(2, () => expect(db.query(`select nextval('public.contact_events_sync_seq')`)).rejects.toThrow());
  });
});

describe('phase 2b lock', () => {
  it('app users, admins included, cannot run the code-merge functions', async () => {
    for (const fn of ['preview_code_merge($1, $2)', 'merge_codes($1, $2)']) {
      await as(1, () => expect(db.query(`select public.${fn}`, [HX, HY])).rejects.toThrow(/permission denied/));
    }
    await as(1, () => expect(db.query('select public.undo_code_merge($1)', [HX])).rejects.toThrow(/permission denied/));
    await as(1, () => expect(db.query('select public.assign_pending_upline($1, $2)', [HX, HY])).rejects.toThrow(/permission denied/));
  });
});

describe('events that change household reach the receiving device', () => {
  it('a code merge, its undo and an admin assignment all land after every cursor', async () => {
    const cursorS2 = await maxSeq(S2);
    const createdS2 = await maxCreated(S2);
    const cursorHY = await maxSeq(HY);
    const createdHY = await maxCreated(HY);

    // merge HY into HX: k1 has a code, so its events move to the upline S2
    const merge = await asOwnerSignedInAs(1, () => one<string>('select public.merge_codes($1, $2) as v', [HX, HY]));
    expect(await pullBySeq(2, S2, cursorS2)).toEqual(expect.arrayContaining([E(1), E(2)]));
    const stale = await pullByCreatedAt(2, S2, createdS2);
    expect(stale).not.toContain(E(1)); // the old cursor misses them: created_at is from January
    expect(stale).not.toContain(E(2));

    // undo: they go back to HY and a HY device pulls them again
    await asOwnerSignedInAs(1, () => db.query('select public.undo_code_merge($1)', [merge]));
    expect(await pullBySeq(6, HY, cursorHY)).toEqual(expect.arrayContaining([E(1), E(2)]));
    expect(await pullByCreatedAt(6, HY, createdHY)).toEqual([]);
    expect(await pullBySeq(2, S2, cursorS2)).not.toContain(E(1));

    // a root household's coded contact waits for an admin, then reaches S2
    const H9 = await provision(9, null, '1000009');
    const H10 = await provision(10, null, '1000010');
    await seed(7, H9, '2026-01-05T00:00:00Z', { personId: 'p3', name: 'P', amwayCode: '3000003' });
    await asOwnerSignedInAs(1, () => db.query('select public.merge_codes($1, $2)', [H10, H9]));
    const cursor = await maxSeq(S2);
    const pending = await one<string>(`select id as v from public.pending_upline where person_id = 'p3'`);
    await asOwnerSignedInAs(1, () => db.query('select public.assign_pending_upline($1, $2)', [pending, S2]));
    expect(await pullBySeq(2, S2, cursor)).toContain(E(7));
  });
});
