// Story 019: runs the accounts migration on an in-memory Postgres (PGlite) with a stub
// `auth` schema and Supabase's roles, then checks the row level security rules as the
// `authenticated` role. Rules: design/quick-specs/supabase-accounts-2026-11-06.md (7–10).
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import MIGRATION_SQL from '../../../supabase/migrations/20261106000000_accounts.sql?raw';

/** Stand-in for what Supabase provides before migrations run. */
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

/** User ids: 1 admin; tree 2 → 3 → 4; 5 a separate root. */
const U = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;

let db: PGlite;

/** Runs `fn` as `authenticated` signed in as user `n` (null: no session). */
async function as<T>(n: number | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${n === null ? '' : U(n)}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role;');
  }
}

/** The last digit of each visible row's id, sorted: "234" means users 2, 3 and 4. */
async function visible(n: number | null, table = 'profiles', column = 'id'): Promise<string> {
  return as(n, async () => {
    const { rows } = await db.query<{ id: string }>(`select ${column} as id from public.${table} order by 1`);
    return rows.map((r) => r.id.slice(-1)).join('');
  });
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(MIGRATION_SQL);
  for (const n of [1, 2, 3, 4, 5]) await db.query('insert into auth.users values ($1, $2)', [U(n), `u${n}`]);
  await db.query(
    `insert into public.profiles (id, phone, role, must_change_password) values ($1, '+84900000001', 'admin', false)`,
    [U(1)],
  );
  await db.query(`insert into public.profiles (id, phone) values ($1, '+84900000002')`, [U(2)]);
  await db.query(`insert into public.profiles (id, phone, sponsor_id) values ($1, '+84900000003', $2)`, [U(3), U(2)]);
  await db.query(`insert into public.profiles (id, phone, sponsor_id) values ($1, '+84900000004', $2)`, [U(4), U(3)]);
  await db.query(`insert into public.profiles (id, phone) values ($1, '+84900000005')`, [U(5)]);
}, 30_000);

afterAll(async () => {
  await db?.close();
});

describe('profiles constraints', () => {
  it('rejects a user sponsoring themself', async () => {
    await expect(db.query('update public.profiles set sponsor_id = $1 where id = $1', [U(2)])).rejects.toThrow();
  });

  it('rejects a sponsor from the downline (cycle)', async () => {
    await expect(db.query('update public.profiles set sponsor_id = $1 where id = $2', [U(4), U(2)])).rejects.toThrow(
      /cycle/,
    );
  });

  it('rejects a phone that is not E.164', async () => {
    await expect(db.query(`insert into public.profiles (id, phone) values ($1, '0912')`, [U(5)])).rejects.toThrow();
  });
});

describe('reading profiles', () => {
  it('a user reads themself and their downline', async () => {
    expect(await visible(2)).toBe('234');
    expect(await visible(3)).toBe('34');
  });

  it('a user with no downline reads only themself', async () => {
    expect(await visible(4)).toBe('4');
    expect(await visible(5)).toBe('5');
  });

  it('an admin reads everyone', async () => {
    expect(await visible(1)).toBe('12345');
  });

  it('no session reads nothing, and anon has no access', async () => {
    expect(await visible(null)).toBe('');
    await db.exec('set role anon;');
    try {
      await expect(db.query('select * from public.profiles')).rejects.toThrow();
    } finally {
      await db.exec('reset role;');
    }
  });
});

describe('writing profiles', () => {
  it('a user cannot change their own role', async () => {
    await as(4, () =>
      expect(db.query(`update public.profiles set role = 'admin' where id = $1`, [U(4)])).rejects.toThrow(),
    );
  });

  it('a user cannot insert a profile', async () => {
    await as(4, () =>
      expect(db.query(`insert into public.profiles (id, phone) values ($1, '+84900000009')`, [U(5)])).rejects.toThrow(),
    );
  });
});

describe('aggregates', () => {
  it('a user writes only their own numbers', async () => {
    await as(4, () => db.query('insert into public.aggregates (user_id, customers, f1) values ($1, 3, 1)', [U(4)]));
    await as(4, () => expect(db.query('insert into public.aggregates (user_id) values ($1)', [U(3)])).rejects.toThrow());
    await as(3, () => db.query('insert into public.aggregates (user_id, customers) values ($1, 7)', [U(3)]));
    const result = await as(4, () => db.query('update public.aggregates set customers = 99 where user_id = $1', [U(3)]));
    expect(result.affectedRows).toBe(0);
  });

  it('upline reads downline numbers, not the other way round', async () => {
    expect(await visible(2, 'aggregates', 'user_id')).toBe('34');
    expect(await visible(4, 'aggregates', 'user_id')).toBe('4');
  });

  it('rejects negative counts', async () => {
    await as(4, () =>
      expect(db.query('update public.aggregates set customers = -1 where user_id = $1', [U(4)])).rejects.toThrow(),
    );
  });
});

describe('RPCs', () => {
  it('mark_password_changed clears only the caller’s flag', async () => {
    await as(2, () => db.query('select public.mark_password_changed()'));
    const { rows } = await db.query<{ s: string }>(
      `select string_agg(right(id::text, 1), '' order by id) as s from public.profiles where must_change_password`,
    );
    expect(rows[0].s).toBe('345');
  });

  it('set_sponsor is admin only, moves a subtree and rejects cycles', async () => {
    await as(2, () => expect(db.query('select public.set_sponsor($1, $2)', [U(5), U(2)])).rejects.toThrow(/admin/));
    await as(1, () => db.query('select public.set_sponsor($1, $2)', [U(5), U(4)]));
    expect(await visible(2)).toBe('2345');
    await as(1, () => expect(db.query('select public.set_sponsor($1, $2)', [U(2), U(5)])).rejects.toThrow(/cycle/));
  });
});
