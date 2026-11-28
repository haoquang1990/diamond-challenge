// Story 070: the people of my Nhóm (vợ/chồng, tuyến trên, tuyến dưới, bạn bè) with their shared
// numbers and whether I cheered them today, and cheers to friends and to my sponsor.
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
  await db.query(`insert into public.member_progress (user_id, xp_7d, streak, goal_today, stats_day) values ($1, 140, 6, true, current_date), ($2, 320, 21, false, current_date)`, [U(3), U(5)]);
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('nhom_people (story 070)', () => {
  it('lists my spouse, sponsor, F1 and friends with their numbers, and nobody else', async () => {
    const rows = await people(2);
    expect(rows.map((r) => `${r.user_id.slice(-1)}:${r.relation}`)).toEqual(['1:upline', '3:spouse', '4:downline', '5:friend']);
    expect(rows.find((r) => r.relation === 'spouse')).toMatchObject({ display_name: 'Người 3', streak: 6, goal_today: true, xp_7d: 140, cheered_today: false });
    expect(rows.find((r) => r.relation === 'friend')).toMatchObject({ household_id: X, streak: 21, goal_today: false });
    expect(rows.find((r) => r.relation === 'downline')?.streak).toBeNull();
  });

  it('a friend who is also my F1 shows once, as tuyến dưới', async () => {
    await db.query(`insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values ($1, $2, $1, 'accepted', now())`, [U(2), U(4)]);
    const rows = await people(2);
    expect(rows.filter((r) => r.user_id === U(4)).map((r) => r.relation)).toEqual(['downline']);
  });
});

describe('cheers to friends and to my sponsor (story 070)', () => {
  it('I can cheer a friend once a day, and it shows as cheered', async () => {
    await expect(cheer(2, M, X, U(5))).resolves.toBeDefined();
    await expect(cheer(2, M, X, U(5))).rejects.toThrow(/already/);
    expect((await people(2)).find((r) => r.user_id === U(5))?.cheered_today).toBe(true);
  });

  it('a stranger cannot be cheered', async () => {
    await expect(cheer(2, M, Y, U(6))).rejects.toThrow();
  });

  it('my spouse can cheer my friend only once they are friends too', async () => {
    await expect(cheer(3, M, X, U(5))).rejects.toThrow();
  });

  it('I can cheer my sponsor household once a day', async () => {
    await expect(cheer(2, M, S, null)).resolves.toBeDefined();
    await expect(cheer(3, M, S, null)).rejects.toThrow(/already/);
    expect((await people(3)).find((r) => r.relation === 'upline')?.cheered_today).toBe(true);
  });

  it('sponsor and spouse cheers still work', async () => {
    await expect(cheer(2, M, F, null)).resolves.toBeDefined();
    await expect(cheer(2, M, M, U(3))).resolves.toBeDefined();
  });

  it('the friend reads the cheer sent to them', async () => {
    const seen = await as(5, async () => (await db.query(`select message from public.cheers where to_user_id = $1`, [U(5)])).rows.length);
    expect(seen).toBe(1);
  });
});
