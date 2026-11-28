// Stories 072-074: the admin sets a household's sponsor by Amway code; an account without a
// sponsor asks one by code and that household accepts; tuyến trên learns an F1's new code.
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

/** Users: 1 admin (household A), 2 (household S, code 7001112223), 3 (household N, code 7005551234, no sponsor), 4 (household F, F1 of N, code 7004440000). */
const U = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;
const H = (c: string) => `10000000-0000-0000-0000-00000000000${c}`;
const [A, S, N, F] = ['a', '5', 'e', 'f'].map(H) as [string, string, string, string];
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
const sponsorOf = async (h: string) => (await db.query<{ s: string | null }>('select sponsor_household_id as s from public.households where id = $1', [h])).rows[0]?.s ?? null;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of Object.keys(MIGRATIONS).sort()) await db.exec(MIGRATIONS[file] ?? '');
  for (const n of [1, 2, 3, 4]) {
    await db.query('insert into auth.users values ($1, $2)', [U(n), `u${n}`]);
    await db.query(`insert into public.profiles (id, phone, must_change_password, display_name, role) values ($1, $2, false, $3, $4)`, [U(n), `+8491111111${n}`, `Người ${n}`, n === 1 ? 'admin' : 'user']);
  }
  await db.query('insert into public.households (id) values ($1), ($2), ($3)', [A, S, N]);
  await db.query('insert into public.households (id, sponsor_household_id) values ($1, $2)', [F, N]);
  await db.query('insert into public.household_members (household_id, user_id) values ($1, $2), ($3, $4), ($5, $6), ($7, $8)', [A, U(1), S, U(2), N, U(3), F, U(4)]);
  await db.query(`insert into public.household_codes (household_id, code) values ($1, '7001112223'), ($2, '7005551234'), ($3, '7004440000')`, [S, N, F]);
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('admin_set_sponsor_by_code (story 072)', () => {
  it('only an admin may use it', async () => {
    await expect(one(2, 'select public.admin_set_sponsor_by_code($1, $2) as r', [N, '7001112223'])).rejects.toThrow(/admin/);
  });

  it('answers not_found for an unknown code, self for its own, cycle for a downline', async () => {
    expect(await one(1, 'select public.admin_set_sponsor_by_code($1, $2) as r', [N, '7009999999'])).toBe('not_found');
    expect(await one(1, 'select public.admin_set_sponsor_by_code($1, $2) as r', [N, '7005551234'])).toBe('self');
    expect(await one(1, 'select public.admin_set_sponsor_by_code($1, $2) as r', [N, '7004440000'])).toBe('cycle');
    expect(await sponsorOf(N)).toBeNull();
  });

  it('sets the sponsor, and an empty code makes the household a root again', async () => {
    expect(await one(1, 'select public.admin_set_sponsor_by_code($1, $2) as r', [N, '7001112223'])).toBe('ok');
    expect(await sponsorOf(N)).toBe(S);
    expect(await one(1, 'select public.admin_set_sponsor_by_code($1, $2) as r', [N, ''])).toBe('ok');
    expect(await sponsorOf(N)).toBeNull();
  });
});

describe('upline requests (story 073)', () => {
  it('a request never tells whether the code exists, and shows only what I typed', async () => {
    expect(await one(3, 'select public.request_upline_by_code($1) as r', ['7009999999'])).toBe('sent');
    expect(await one(3, 'select code as r from public.my_upline_request()')).toBe('7009999999');
    expect(await one(3, 'select public.request_upline_by_code($1) as r', ['abc'])).toBe('invalid');
  });

  it('the asked household sees it with the asker\'s name and code; others do not', async () => {
    expect(await one(3, 'select public.request_upline_by_code($1) as r', ['7001112223'])).toBe('sent');
    const seen = await as(2, async () => (await db.query<{ names: string; code: string }>('select names, code from public.upline_invites()')).rows);
    expect(seen).toEqual([{ names: 'Người 3', code: '7005551234' }]);
    expect(await as(4, async () => (await db.query('select * from public.upline_invites()')).rows.length)).toBe(0);
    await expect(as(3, () => db.query('select * from public.upline_requests'))).rejects.toThrow();
  });

  it('only the asked household can accept, and accepting links the two', async () => {
    const id = await as(2, async () => (await db.query<{ id: string }>('select id from public.upline_invites()')).rows[0]?.id);
    expect(await one(4, 'select public.respond_upline($1, true) as r', [id])).toBe('not_found');
    expect(await one(2, 'select public.respond_upline($1, true) as r', [id])).toBe('ok');
    expect(await sponsorOf(N)).toBe(S);
    expect(await one(3, 'select count(*)::int as r from public.my_upline_request()')).toBe(0);
  });

  it('a household that has a sponsor cannot ask again', async () => {
    expect(await one(3, 'select public.request_upline_by_code($1) as r', ['7001112223'])).toBe('has_upline');
  });

  it('declining or cancelling closes the request', async () => {
    await db.query('update public.households set sponsor_household_id = null where id = $1', [N]);
    expect(await one(3, 'select public.request_upline_by_code($1) as r', ['7001112223'])).toBe('sent');
    expect(await one(3, 'select public.cancel_upline_request() as r')).toBe('ok');
    expect(await as(2, async () => (await db.query('select * from public.upline_invites()')).rows.length)).toBe(0);
  });
});

describe('downline_code_changes (story 074)', () => {
  it('lists the old and new code of an F1 whose code was replaced, to its sponsor only', async () => {
    await db.query(`update public.household_codes set status = 'cancelled', cancelled_at = now(), cancel_reason = 'replaced' where household_id = $1`, [F]);
    await db.query(`insert into public.household_codes (household_id, code) values ($1, '7004449999')`, [F]);
    const rows = await as(3, async () => (await db.query<{ old_code: string; new_code: string }>('select old_code, new_code from public.downline_code_changes()')).rows);
    expect(rows).toEqual([{ old_code: '7004440000', new_code: '7004449999' }]);
    expect(await as(2, async () => (await db.query('select * from public.downline_code_changes()')).rows.length)).toBe(0);
  });
});
