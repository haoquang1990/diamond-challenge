// Story 071: what a friend sees of me depends on my "Chia sẻ với bạn bè" switches (tasks of 7
// days, KH / NPP counts; off by default), and everyone's XP of this week for the ranking.
// Applies every migration on in-memory Postgres (PGlite) and calls as `authenticated`.
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const MIGRATIONS = import.meta.glob('../../../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

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

/**
 * Households: S (sponsor, user 1), M (mine: users 2 and 3), F (my F1: user 4), X (a friend's: user 5),
 * Y (stranger: user 6). M is sponsored by S, F by M. Users 2 and 5 are friends.
 */
const U = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;
const H = (c: string) => `10000000-0000-0000-0000-00000000000${c}`;
const [S, M, F, X, Y] = ['5', 'a', 'f', 'b', 'c'].map(H) as [string, string, string, string, string];
let db: PGlite;

async function as<T>(n: number, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${U(n)}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}
type Row = { user_id: string; relation: string; household_id: string; display_name: string | null; streak: number | null; goal_today: boolean | null; xp_7d: number | null; cheered_today: boolean };
const people = (n: number) => as(n, async () => (await db.query<Row>('select * from public.nhom_people() order by user_id')).rows);
const cheer = (n: number, from: string, to: string, toUser: string | null) =>
  as(n, () => db.query('insert into public.cheers (from_household_id, to_household_id, to_user_id, message) values ($1, $2, $3, $4)', [from, to, toUser, 'Cố lên!']));

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of Object.keys(MIGRATIONS).sort()) await db.exec(MIGRATIONS[file] ?? '');
  for (const n of [1, 2, 3, 4, 5, 6]) {
    await db.query('insert into auth.users values ($1, $2)', [U(n), `u${n}`]);
    await db.query(`insert into public.profiles (id, phone, must_change_password, display_name) values ($1, $2, false, $3)`, [U(n), `+8491111111${n}`, `Người ${n}`]);
  }
  await db.query('insert into public.households (id) values ($1), ($2), ($3)', [S, X, Y]);
  await db.query('insert into public.households (id, sponsor_household_id) values ($1, $2)', [M, S]);
  await db.query('insert into public.households (id, sponsor_household_id) values ($1, $2)', [F, M]);
  await db.query(
    'insert into public.household_members (household_id, user_id) values ($1, $2), ($3, $4), ($3, $5), ($6, $7), ($8, $9), ($10, $11)',
    [S, U(1), M, U(2), U(3), F, U(4), X, U(5), Y, U(6)],
  );
  await db.query(`insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values ($1, $2, $1, 'accepted', now())`, [U(2), U(5)]);
  await db.query(`insert into public.member_progress (user_id, xp_7d, streak, goal_today, stats_day, tasks_7d, xp_week, week_start) values ($1, 140, 6, true, current_date, '{"demo":2}', 90, '2026-11-23'), ($2, 320, 21, false, current_date, '{"contact":9}', 250, '2026-11-23')`, [U(3), U(5)]);
  await db.query('insert into public.household_aggregates (household_id, customers, f1) values ($1, 3, 1), ($2, 7, 2)', [M, X]);
}, 60_000);

afterAll(async () => {
  await db.close();
});

type Share = { relation: string; xp_week: number | null; week_start: string | null; tasks_7d: Record<string, number> | null; customers: number | null; f1: number | null };
const view = (n: number, other: number) => as(n, async () => (await db.query<Share>('select relation, xp_week, week_start::text as week_start, tasks_7d, customers, f1 from public.nhom_people() where user_id = $1', [U(other)])).rows[0]);

describe('friend sharing and weekly XP (story 071)', () => {
  it('everyone in my Nhóm shows XP of the week', async () => {
    expect(await view(2, 5)).toMatchObject({ xp_week: 250, week_start: '2026-11-23' });
    expect(await view(2, 3)).toMatchObject({ xp_week: 90 });
  });

  it('a friend sees no tasks or counts until I switch them on, my spouse always does', async () => {
    expect(await view(2, 5)).toMatchObject({ tasks_7d: null, customers: null, f1: null });
    expect(await view(2, 3)).toMatchObject({ tasks_7d: { demo: 2 }, customers: 3, f1: 1 });
    await as(5, () => db.query('insert into public.friend_share (user_id, tasks, counts) values ($1, true, false)', [U(5)]));
    expect(await view(2, 5)).toMatchObject({ tasks_7d: { contact: 9 }, customers: null });
    await as(5, () => db.query('update public.friend_share set counts = true where user_id = $1', [U(5)]));
    expect(await view(2, 5)).toMatchObject({ customers: 7, f1: 2 });
  });

  it('nobody reads or sets someone else\'s switches', async () => {
    const seen = await as(2, async () => (await db.query('select * from public.friend_share')).rows.length);
    expect(seen).toBe(0);
    await expect(as(2, () => db.query('insert into public.friend_share (user_id, tasks) values ($1, true)', [U(6)]))).rejects.toThrow();
  });
});
