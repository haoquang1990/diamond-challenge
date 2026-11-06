// ADR-0001..0003: runs both migrations on in-memory Postgres (PGlite) with a stub auth schema,
// then checks the household model as the `authenticated` role: conversion of story 019 data,
// members limit, unique codes, the members-only contact book, and merging two codes.
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import ACCOUNTS_SQL from '../../../supabase/migrations/20261106000000_accounts.sql?raw';
import HOUSEHOLDS_SQL from '../../../supabase/migrations/20261107000000_households.sql?raw';

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
`;

/** User n: 1 admin; 2 root; 3 sponsored by 2 (both from story 019 data); the rest provisioned later. */
const U = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const E = (n: number) => `10000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

let db: PGlite;
let eventSeq = 0;

async function as<T>(n: number | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${n === null ? '' : U(n)}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}

async function asService<T>(fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role service_role; select set_config('request.jwt.claim.sub', '', false);`);
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

/** The caller's household id. */
const householdOf = (n: number) =>
  one<string>('select household_id as v from public.household_members where user_id = $1 and left_at is null', [U(n)]);

async function newUser(n: number): Promise<void> {
  await db.query('insert into auth.users values ($1, $2)', [U(n), `u${n}`]);
}

/** Provisions user n in a new household sponsored by `sponsor` (null = root), as the Edge Function would. */
async function provisionHousehold(n: number, sponsor: string | null, code: string, by: number): Promise<string> {
  await newUser(n);
  return asService(() =>
    one<string>('select public.provision_household($1, $2, $3, $4, $5, $6) as v', [
      U(n), `+849000000${String(n).padStart(2, '0')}`, sponsor, code, U(by), `User ${n}`,
    ]),
  );
}

/** Appends a contact event as user n into household h; returns its id. */
async function addEvent(n: number, h: string, type: string, payload: Record<string, unknown>): Promise<string> {
  const id = E(++eventSeq);
  await as(n, () =>
    db.query(
      `insert into public.contact_events (id, household_id, author_id, type, occurred_at, payload) values ($1, $2, $3, $4, now(), $5)`,
      [id, h, U(n), type, JSON.stringify(payload)],
    ),
  );
  return id;
}

/** Person ids user n can see in household h's book (sorted, deduplicated). */
async function people(n: number | null, h: string): Promise<string> {
  return as(n, async () => {
    const { rows } = await db.query<{ p: string }>(
      `select distinct payload ->> 'personId' as p from public.contact_events where household_id = $1 order by 1`,
      [h],
    );
    return rows.map((r) => r.p).join(',');
  });
}

const visibleCount = (n: number | null, table: string) =>
  as(n, () => one<number>(`select count(*)::int as v from public.${table}`));

let H1: string, H2: string, H3: string, H4: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(ACCOUNTS_SQL);
  // story 019 data: admin 1, root 2, 3 under 2 with numbers
  for (const n of [1, 2, 3]) await newUser(n);
  await db.query(`insert into public.profiles (id, phone, role, must_change_password) values ($1, '+84948161365', 'admin', false)`, [U(1)]);
  await db.query(`insert into public.profiles (id, phone) values ($1, '+84900000002')`, [U(2)]);
  await db.query(`insert into public.profiles (id, phone, sponsor_id) values ($1, '+84900000003', $2)`, [U(3), U(2)]);
  await db.query(`insert into public.aggregates (user_id, customers, f1, achieved_30x30) values ($1, 7, 2, false)`, [U(3)]);
  await db.exec(HOUSEHOLDS_SQL);
  await db.exec('grant all on all tables in schema public to service_role;');
  [H1, H2, H3] = await Promise.all([householdOf(1), householdOf(2), householdOf(3)]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('conversion of story 019 data', () => {
  it('keeps the admin, gives each person a household and turns the tree into a household tree', async () => {
    expect(await one<string>('select role as v from public.profiles where id = $1', [U(1)])).toBe('admin');
    expect(H1 && H2 && H3).toBeTruthy();
    expect(await one<string>('select sponsor_household_id as v from public.households where id = $1', [H3])).toBe(H2);
    expect(await one<number>('select customers as v from public.household_aggregates where household_id = $1', [H3])).toBe(7);
    expect(await one<number>(`select count(*)::int as v from information_schema.columns where table_name = 'profiles' and column_name = 'sponsor_id'`)).toBe(0);
  });
});

describe('codes and members', () => {
  it('admin sets household codes; a duplicate active code is refused', async () => {
    await as(1, () => db.query(`select public.set_household_code($1, '1000002')`, [H2]));
    await as(1, () => db.query(`select public.set_household_code($1, '100.0003')`, [H3]));
    expect(await one<string>(`select code as v from public.household_codes where household_id = $1 and status = 'active'`, [H3])).toBe('1000003');
    await as(2, () => expect(db.query(`select public.set_household_code($1, '1000009')`, [H2])).rejects.toThrow(/admin/));
    H4 = await provisionHousehold(4, H3, '1000004', 3);
    await expect(provisionHousehold(40, H3, '1000004', 3)).rejects.toThrow(/already active/);
  });

  it('only a member of the sponsor household (or an admin) creates an F1 household', async () => {
    await expect(provisionHousehold(41, H3, '1000041', 4)).rejects.toThrow(/not a member/);
    await expect(provisionHousehold(42, null, '1000042', 3)).rejects.toThrow(/admin/);
  });

  it('a household holds at most two members; the sponsor may add the spouse', async () => {
    await newUser(5);
    await asService(() => db.query(`select public.provision_member($1, '+84900000005', $2, $3)`, [U(5), H3, U(2)]));
    expect(await householdOf(5)).toBe(H3);
    await newUser(6);
    await expect(
      asService(() => db.query(`select public.provision_member($1, '+84900000006', $2, $3)`, [U(6), H3, U(3)])),
    ).rejects.toThrow(/already has 2 members/);
    await newUser(43);
    await expect(
      asService(() => db.query(`select public.provision_member($1, '+84900000043', $2, $3)`, [U(43), H3, U(4)])),
    ).rejects.toThrow(/may not add/);
  });
});

describe('who sees households', () => {
  it('upline sees the F1 household, its code, members and numbers; downline does not see upline', async () => {
    const seen = await as(2, async () => ({
      household: await one<number>('select count(*)::int as v from public.households where id = $1', [H3]),
      code: await one<string>(`select code as v from public.household_codes where household_id = $1 and status = 'active'`, [H3]),
      members: await one<number>(`select count(*)::int as v from public.profiles where id in ($1, $2)`, [U(3), U(5)]),
      numbers: await one<number>('select count(*)::int as v from public.household_aggregates where household_id = $1', [H3]),
    }));
    expect(seen).toEqual({ household: 1, code: '1000003', members: 2, numbers: 1 });
    expect(await as(4, () => one<number>('select count(*)::int as v from public.households where id = $1', [H3]))).toBe(0);
    expect(await as(4, () => one<number>('select count(*)::int as v from public.profiles where id = $1', [U(3)]))).toBe(0);
  });

  it('anon reads nothing', async () => {
    await db.exec('set role anon;');
    try {
      await expect(db.query('select * from public.households')).rejects.toThrow();
      await expect(db.query('select * from public.contact_events')).rejects.toThrow();
    } finally {
      await db.exec('reset role;');
    }
  });
});

describe('the household contact book', () => {
  it('needs consent before a member can append', async () => {
    await expect(addEvent(3, H3, 'person_added', { personId: 'a', name: 'An' })).rejects.toThrow();
    await as(3, () => db.query('select public.record_contact_consent(1)'));
    await as(5, () => db.query('select public.record_contact_consent(1)'));
    await addEvent(3, H3, 'person_added', { personId: 'a', name: 'An', amwayCode: '2000001' });
    await addEvent(5, H3, 'activity_logged', { personId: 'a', activityType: 'demo', taskId: 'demo', xp: 10 });
  });

  it('both members read the book; upline, downline, admin and outsiders read nothing', async () => {
    expect(await people(3, H3)).toBe('a');
    expect(await people(5, H3)).toBe('a');
    expect(await people(2, H3)).toBe(''); // upline
    expect(await people(4, H3)).toBe(''); // downline
    expect(await people(1, H3)).toBe(''); // admin through the API
    expect(await people(null, H3)).toBe('');
  });

  it('refuses writing as someone else, into another household, server-only types and personal activities', async () => {
    await expect(
      as(5, () =>
        db.query(
          `insert into public.contact_events (id, household_id, author_id, type, occurred_at, payload) values ($1, $2, $3, 'person_added', now(), '{"personId":"x"}')`,
          [E(900), H3, U(3)],
        ),
      ),
    ).rejects.toThrow();
    await expect(addEvent(3, H4, 'person_added', { personId: 'x', name: 'X' })).rejects.toThrow();
    await expect(addEvent(3, H3, 'person_transferred_out', { personId: 'a', name: 'An' })).rejects.toThrow();
    await expect(addEvent(3, H3, 'activity_logged', { activityType: 'lesson', xp: 10 })).rejects.toThrow();
  });

  it('no member can change or delete an event', async () => {
    const changed = await as(3, () => db.query(`update public.contact_events set payload = '{}' where household_id = $1`, [H3]).catch(() => null));
    expect(changed === null || changed.affectedRows === 0).toBe(true);
    const removed = await as(3, () => db.query('delete from public.contact_events where household_id = $1', [H3]).catch(() => null));
    expect(removed === null || removed.affectedRows === 0).toBe(true);
    expect(await people(3, H3)).toBe('a');
  });
});

describe('merging two codes into one household', () => {
  let HX: string, HY: string, H7: string;

  beforeAll(async () => {
    // HY (user 6, code Y) and HX (user 8, code X) both sponsored by H2 (S2); H7 is HY's F1
    await db.query('delete from auth.users where id = $1', [U(6)]);
    HY = await provisionHousehold(6, H2, '1000006', 2);
    HX = await provisionHousehold(8, H2, '1000008', 2);
    H7 = await provisionHousehold(7, HY, '1000007', 6);
    for (const n of [6, 8]) await as(n, () => db.query('select public.record_contact_consent(1)'));
    await addEvent(6, HY, 'person_added', { personId: 'k1', name: 'Khách Có Mã', amwayCode: '3000001' });
    await addEvent(6, HY, 'activity_logged', { personId: 'k1', activityType: 'new_customer', taskId: 'new_customer', xp: 30 });
    await addEvent(6, HY, 'person_added', { personId: 'q1', name: 'Người Quen' });
    await addEvent(8, HX, 'person_added', { personId: 'x1', name: 'Bạn Của Lan' });
  });

  it('preview counts without writing; only an admin or the sponsor of the kept household may run it', async () => {
    const preview = await as(2, () => one<Record<string, unknown>>('select public.preview_code_merge($1, $2) as v', [HX, HY]));
    expect(preview).toMatchObject({ transfer: 1, stay: 1, downlineHouseholds: 1, uplineHouseholdId: H2, membersAfter: 2 });
    expect(await people(6, HY)).toBe('k1,q1');
    await as(4, () => expect(db.query('select public.merge_codes($1, $2)', [HX, HY])).rejects.toThrow(/sponsor/));
  });

  let mergeId: string;

  it('moves coded contacts to the upline, the rest into the kept book, and retires code Y', async () => {
    mergeId = await as(2, () => one<string>('select public.merge_codes($1, $2) as v', [HX, HY]));
    expect(await people(2, H2)).toBe('k1'); // S2 now reads the transferred contact with its history
    expect(await as(2, () => one<number>(`select count(*)::int as v from public.contact_events where household_id = $1 and payload ->> 'personId' = 'k1'`, [H2]))).toBe(2);
    expect(await people(8, HX)).toBe('k1,q1,x1'); // k1 only as the transferred line
    const k1InX = await as(8, () =>
      db.query<{ type: string; payload: Record<string, unknown> }>(
        `select type, payload from public.contact_events where household_id = $1 and payload ->> 'personId' = 'k1'`,
        [HX],
      ),
    );
    expect(k1InX.rows).toEqual([{ type: 'person_transferred_out', payload: { personId: 'k1', name: 'Khách Có Mã' } }]);
    expect(await householdOf(6)).toBe(HX);
    expect(await people(6, HX)).toBe('k1,q1,x1');
    expect(await one<string>('select sponsor_household_id as v from public.households where id = $1', [H7])).toBe(H2);
    expect(await one<string>(`select status as v from public.household_codes where code = '1000006'`)).toBe('cancelled');
    expect(await one<string>('select status as v from public.households where id = $1', [HY])).toBe('merged');
  });

  it('admin undoes the merge once', async () => {
    await as(2, () => expect(db.query('select public.undo_code_merge($1)', [mergeId])).rejects.toThrow(/admin/));
    await as(1, () => db.query('select public.undo_code_merge($1)', [mergeId]));
    expect(await people(2, H2)).toBe('');
    expect(await householdOf(6)).toBe(HY);
    expect(await people(6, HY)).toBe('k1,q1');
    expect(await people(8, HX)).toBe('x1');
    expect(await one<string>('select sponsor_household_id as v from public.households where id = $1', [H7])).toBe(HY);
    expect(await one<string>(`select status as v from public.household_codes where code = '1000006'`)).toBe('active');
    await as(1, () => expect(db.query('select public.undo_code_merge($1)', [mergeId])).rejects.toThrow(/already undone/));
  });

  it('a root household without upline puts coded contacts on the admin waiting list', async () => {
    const H9 = await provisionHousehold(9, null, '1000009', 1);
    const H10 = await provisionHousehold(10, null, '1000010', 1);
    for (const n of [9, 10]) await as(n, () => db.query('select public.record_contact_consent(1)'));
    await addEvent(9, H9, 'person_added', { personId: 'p3', name: 'Chờ Gán', amwayCode: '3000003' });
    await as(1, () => db.query('select public.merge_codes($1, $2)', [H10, H9]));
    expect(await people(10, H10)).toBe('p3'); // the transferred line only
    expect(await as(10, () => one<number>(`select count(*)::int as v from public.contact_events where payload ->> 'personId' = 'p3' and type <> 'person_transferred_out'`))).toBe(0);
    expect(await visibleCount(10, 'pending_upline')).toBe(0);
    const pending = await as(1, () => one<string>(`select id as v from public.pending_upline where person_id = 'p3'`));
    await as(1, () => db.query('select public.assign_pending_upline($1, $2)', [pending, H2]));
    expect(await people(2, H2)).toBe('p3');
  });
});

describe('leaving a household', () => {
  it('the leaver loses the book and gets a new household with the same sponsor and no code', async () => {
    const newHousehold = await as(5, () => one<string>('select public.leave_household() as v'));
    expect(await people(5, H3)).toBe('');
    expect(await one<string>('select sponsor_household_id as v from public.households where id = $1', [newHousehold])).toBe(H2);
    expect(await one<number>(`select count(*)::int as v from public.household_codes where household_id = $1`, [newHousehold])).toBe(0);
    await as(3, () => expect(db.query('select public.leave_household()')).rejects.toThrow(/only member/));
  });
});
