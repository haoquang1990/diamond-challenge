// Story 068: an account whose household has no active Amway code sets it once with
// claim_household_code; a code another household already holds becomes a claim for the admin.
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

/** Users: 1 and 2 share household A (no code), 3 is in household B (code 7001234567), 4 has none. */
const U = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;
const HA = '10000000-0000-0000-0000-00000000000a';
const HB = '10000000-0000-0000-0000-00000000000b';
let db: PGlite;

async function as<T>(n: number, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${U(n)}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}
const claim = (n: number, code: string) => as(n, async () => (await db.query<{ r: string }>('select public.claim_household_code($1) as r', [code])).rows[0]?.r);
const activeCode = async (h: string) => (await db.query<{ code: string }>(`select code from public.household_codes where household_id = $1 and status = 'active'`, [h])).rows[0]?.code ?? null;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of Object.keys(MIGRATIONS).sort()) await db.exec(MIGRATIONS[file] ?? '');
  for (const n of [1, 2, 3, 4]) {
    await db.query('insert into auth.users values ($1, $2)', [U(n), `u${n}`]);
    await db.query(`insert into public.profiles (id, phone, must_change_password) values ($1, $2, false)`, [U(n), `+8491111111${n}`]);
  }
  await db.query('insert into public.households (id) values ($1), ($2)', [HA, HB]);
  await db.query('insert into public.household_members (household_id, user_id) values ($1, $2), ($1, $3), ($4, $5)', [HA, U(1), U(2), HB, U(3)]);
  await db.query(`insert into public.household_codes (household_id, code) values ($1, '7001234567')`, [HB]);
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('claim_household_code (story 068)', () => {
  it('rejects a code that is not 4 to 15 digits', async () => {
    expect(await claim(1, '12ab')).toBe('invalid');
    expect(await activeCode(HA)).toBeNull();
  });

  it('a code someone else holds becomes a pending claim, visible to both members of my household only', async () => {
    expect(await claim(1, '7001234567')).toBe('taken');
    expect(await activeCode(HA)).toBeNull();
    const seen = (n: number) => as(n, async () => (await db.query(`select code from public.code_claims where status = 'pending'`)).rows.length);
    expect(await seen(2)).toBe(1);
    expect(await seen(3)).toBe(0);
  });

  it('a free code is saved for the household and closes the pending claim', async () => {
    expect(await claim(2, ' 7009998887 ')).toBe('saved');
    expect(await activeCode(HA)).toBe('7009998887');
    const pending = await db.query(`select 1 from public.code_claims where household_id = $1 and status = 'pending'`, [HA]);
    expect(pending.rows).toHaveLength(0);
  });

  it('once a code is set it cannot be changed this way', async () => {
    expect(await claim(1, '7005554443')).toBe('already_set');
    expect(await activeCode(HA)).toBe('7009998887');
  });

  it('an account without a household gets no_household', async () => {
    expect(await claim(4, '7005554443')).toBe('no_household');
  });

  it('nobody can write code_claims directly', async () => {
    await expect(as(1, () => db.query(`insert into public.code_claims (household_id, claimed_by, code) values ($1, $2, '7000000000')`, [HA, U(1)]))).rejects.toThrow();
  });
});
