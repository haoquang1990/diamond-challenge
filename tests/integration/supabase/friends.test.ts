// Story 069: friends. Requests by Amway code (to every member of that household) or by my
// invite link, accept / decline / remove, the limit, and that nobody learns whether a code exists.
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

/** Users: 1 (household A, code 7001111111); 2 and 3 share household B (code 7002222222); 4 household C (7003333333); 5 household D. */
const U = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;
const H = (c: string) => `10000000-0000-0000-0000-00000000000${c}`;
let db: PGlite;

async function as<T>(n: number, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${U(n)}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}
const one = async (n: number, sql: string, params: unknown[] = []) => as(n, async () => (await db.query<{ r: unknown }>(sql, params)).rows[0]?.r);
const byCode = (n: number, code: string) => one(n, 'select public.request_friend_by_code($1) as r', [code]);
const friends = (n: number) =>
  as(n, async () => (await db.query<{ friend_id: string; status: string; incoming: boolean; display_name: string | null; code: string | null }>('select * from public.my_friends() order by friend_id')).rows);
const idOf = async (n: number, other: number) => (await friends(n)).find((f) => f.friend_id === U(other));
const respond = (n: number, other: number, accept: boolean) => one(n, 'select public.respond_friend($1, $2) as r', [U(other), accept]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of Object.keys(MIGRATIONS).sort()) await db.exec(MIGRATIONS[file] ?? '');
  for (const n of [1, 2, 3, 4, 5]) {
    await db.query('insert into auth.users values ($1, $2)', [U(n), `u${n}`]);
    await db.query(`insert into public.profiles (id, phone, must_change_password, display_name) values ($1, $2, false, $3)`, [U(n), `+8491111111${n}`, `Người ${n}`]);
  }
  await db.query('insert into public.households (id) values ($1), ($2), ($3), ($4)', [H('a'), H('b'), H('c'), H('d')]);
  await db.query('insert into public.household_members (household_id, user_id) values ($1, $2), ($3, $4), ($3, $5), ($6, $7), ($8, $9)', [H('a'), U(1), H('b'), U(2), U(3), H('c'), U(4), H('d'), U(5)]);
  await db.query(`insert into public.household_codes (household_id, code) values ($1, '7001111111'), ($2, '7002222222'), ($3, '7003333333')`, [H('a'), H('b'), H('c')]);
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('friends (story 069)', () => {
  it('a request by code reaches every member of that household; the answer never tells whether the code exists', async () => {
    expect(await byCode(1, '7002222222')).toBe('sent');
    expect(await byCode(1, '7009999999')).toBe('sent');
    expect(await byCode(1, 'abc')).toBe('invalid');
    expect((await idOf(2, 1))?.incoming).toBe(true);
    expect((await idOf(3, 1))?.status).toBe('pending');
    expect((await idOf(1, 2))?.incoming).toBe(false);
    expect((await idOf(1, 2))?.code).toBeNull();
  });

  it('my own household code sends nothing', async () => {
    expect(await byCode(2, '7002222222')).toBe('sent');
    expect(await idOf(2, 3)).toBeUndefined();
  });

  it('accepting makes us friends and shows name and code; declining removes the request', async () => {
    expect(await respond(2, 1, true)).toBe('ok');
    expect(await idOf(1, 2)).toMatchObject({ status: 'accepted', display_name: 'Người 2', code: '7002222222' });
    expect(await respond(3, 1, false)).toBe('ok');
    expect(await idOf(1, 3)).toBeUndefined();
  });

  it('only the asked person can accept', async () => {
    await byCode(4, '7001111111');
    expect(await respond(4, 1, true)).toBe('not_found');
    expect((await idOf(1, 4))?.status).toBe('pending');
  });

  it('a request back to someone who asked me accepts it', async () => {
    expect(await byCode(1, '7003333333')).toBe('sent');
    expect((await idOf(4, 1))?.status).toBe('accepted');
  });

  it('a request by my invite link reaches me', async () => {
    const token = (await one(1, 'select public.my_friend_token() as r')) as string;
    expect(token).toMatch(/^[0-9a-z]{16,}$/);
    expect(await one(1, 'select public.my_friend_token() as r')).toBe(token);
    expect(await one(5, 'select public.request_friend_by_token($1) as r', [token])).toBe('sent');
    expect((await idOf(1, 5))?.incoming).toBe(true);
    expect(await one(5, 'select public.request_friend_by_token($1) as r', ['nope'])).toBe('sent');
  });

  it('either friend can remove the friendship', async () => {
    expect(await one(2, 'select public.remove_friend($1) as r', [U(1)])).toBe('ok');
    expect(await idOf(1, 2)).toBeUndefined();
  });

  it('nobody reads or writes friendships of others, nor writes the table directly', async () => {
    const seen = await as(3, async () => (await db.query('select * from public.friendships')).rows.length);
    expect(seen).toBe(0);
    await expect(as(1, () => db.query('insert into public.friendships (user_a, user_b, requested_by) values ($1, $2, $1)', [U(1), U(3)]))).rejects.toThrow();
  });

  it('stops at the friend limit', async () => {
    await db.query(`update public.app_config set value = '1' where key = 'friends_max'`);
    expect(await byCode(5, '7003333333')).toBe('limit');
    await db.query(`update public.app_config set value = '50' where key = 'friends_max'`);
  });
});
