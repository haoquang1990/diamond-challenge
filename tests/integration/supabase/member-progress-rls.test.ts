// Story 044: `member_progress` (total XP, 7-day XP, streak per account) is written only by its
// owner and readable by the owner's household, its upline chain and admins. Applies every
// migration in order on in-memory Postgres (PGlite) and checks as the `authenticated` role.
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
const MIGRATIONS = import.meta.glob('../../../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const ACCOUNTS_FILE = Object.keys(MIGRATIONS).sort()[0] ?? '';

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

let db: PGlite;

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


// Tree: A (user 2, root) -> B (user 3) -> C (user 4); user 6 is an unrelated root; user 7 is B's spouse.
let A: string, B: string;

const save = (n: number, xp: number, xp7: number, streak: number) =>
  as(n, () =>
    db.query(
      `insert into public.member_progress (user_id, xp_total, xp_7d, streak) values ($1, $2, $3, $4)
       on conflict (user_id) do update set xp_total = excluded.xp_total, xp_7d = excluded.xp_7d, streak = excluded.streak`,
      [U(n), xp, xp7, streak],
    ),
  );
const seen = (viewer: number, owner: number) =>
  as(viewer, () => one<number | null>('select xp_total as v from public.member_progress where user_id = $1', [U(owner)]));

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(MIGRATIONS[ACCOUNTS_FILE] ?? '');
  await db.query('insert into auth.users values ($1, $2)', [U(1), 'u1']);
  await db.query(`insert into public.profiles (id, phone, role, must_change_password) values ($1, '+84948161365', 'admin', false)`, [U(1)]);
  for (const file of Object.keys(MIGRATIONS).sort().slice(1)) await db.exec(MIGRATIONS[file] ?? '');
  await db.exec('grant all on all tables in schema public to service_role;');
  A = await provision(2, null, '2000002', 1);
  B = await provision(3, A, '2000003', 2);
  await provision(4, B, '2000004', 3);
  await provision(6, null, '2000006', 1);
  await db.query('insert into auth.users values ($1, $2)', [U(7), 'u7']);
  await db.query(`insert into public.profiles (id, phone, must_change_password) values ($1, '+84900000007', false)`, [U(7)]);
  await db.query('insert into public.household_members (household_id, user_id) values ($1, $2)', [B, U(7)]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('member_progress (story 044)', () => {
  it('lets an account write and update its own numbers', async () => {
    await save(3, 120, 40, 2);
    await save(3, 150, 60, 3);
    expect(await seen(3, 3)).toBe(150);
  });

  it('refuses writing another account\'s numbers and negative values', async () => {
    await expect(as(3, () => db.query('insert into public.member_progress (user_id, xp_total) values ($1, 1)', [U(4)]))).rejects.toThrow();
    await expect(save(4, -1, 0, 0)).rejects.toThrow();
  });

  it('is readable by the household, the upline chain and admins, not by others', async () => {
    await save(4, 80, 10, 1);
    expect(await seen(7, 3)).toBe(150); // spouse in the same household
    expect(await seen(2, 3)).toBe(150); // direct sponsor
    expect(await seen(2, 4)).toBe(80); // upline two levels up
    expect(await seen(1, 4)).toBe(80); // admin
    expect(await seen(6, 3)).toBeUndefined(); // unrelated root
    expect(await seen(4, 3)).toBeUndefined(); // downline cannot read its upline
  });

  it('stores the story 050 numbers and rejects bad ones', async () => {
    await as(3, () => db.query(`update public.member_progress set stats_day = '2026-11-26', goal_today = true, active_days_7d = 3, tasks_7d = '{"demo":2}', lessons_distinct = 12, badges_7d = 1, last_seen_at = now() where user_id = $1`, [U(3)]));
    expect(await as(2, () => one<number>('select active_days_7d as v from public.member_progress where user_id = $1', [U(3)]))).toBe(3);
    await expect(as(3, () => db.query('update public.member_progress set active_days_7d = 8 where user_id = $1', [U(3)]))).rejects.toThrow();
  });

  it('tells the direct sponsor and the household whether accounts are activated, nobody else', async () => {
    await db.query('update public.profiles set must_change_password = true where id = $1', [U(4)]);
    await db.query('update public.profiles set must_change_password = false where id = $1', [U(3)]);
    const asSponsor = await as(2, () => db.query<{ user_id: string; activated: boolean }>('select * from public.f1_member_activation($1)', [[U(3), U(4)]]));
    expect(asSponsor.rows).toEqual([{ user_id: U(3), activated: true }]); // user 4 is two levels down
    const asParent = await as(3, () => db.query<{ user_id: string; activated: boolean }>('select * from public.f1_member_activation($1)', [[U(4)]]));
    expect(asParent.rows).toEqual([{ user_id: U(4), activated: false }]);
    const asStranger = await as(6, () => db.query('select * from public.f1_member_activation($1)', [[U(3)]]));
    expect(asStranger.rows).toEqual([]);
  });

  it('sets updated_at on every write', async () => {
    const at = await as(3, () => one<string>('select updated_at::text as v from public.member_progress where user_id = $1', [U(3)]));
    expect(at).not.toBeNull();
  });
});
