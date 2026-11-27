// Story 057: `push_subscriptions` (where to send web pushes for an account) is owner-only. The
// app stores a browser through `register_push_subscription`, which moves an endpoint that belonged
// to another account (the same browser signed in as someone else). Applies every migration.
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



beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(MIGRATIONS[ACCOUNTS_FILE] ?? '');
  await db.query('insert into auth.users values ($1, $2)', [U(1), 'u1']);
  await db.query(`insert into public.profiles (id, phone, role, must_change_password) values ($1, '+84948161365', 'admin', false)`, [U(1)]);
  for (const file of Object.keys(MIGRATIONS).sort().slice(1)) await db.exec(MIGRATIONS[file] ?? '');
  await db.exec('grant all on all tables in schema public to service_role;');
  await provision(2, null, '2000002', 1);
  await provision(3, null, '2000003', 1);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

const register = (n: number, endpoint: string) =>
  as(n, () => db.query('select public.register_push_subscription($1, $2, $3)', [endpoint, 'p256dh-key', 'auth-key']));
const count = (n: number) => as(n, () => one<number>('select count(*)::int as v from public.push_subscriptions'));

describe('push_subscriptions (story 057)', () => {
  it('stores my browser once, however often it registers', async () => {
    await register(2, 'https://push.example.test/a');
    await register(2, 'https://push.example.test/a');
    expect(await count(2)).toBe(1);
  });

  it('is visible only to its owner', async () => {
    expect(await count(3)).toBe(0);
  });

  it('moves a browser to the account that registers it now', async () => {
    await register(3, 'https://push.example.test/a');
    expect(await count(2)).toBe(0);
    expect(await count(3)).toBe(1);
  });

  it('refuses direct writes and odd endpoints', async () => {
    await expect(as(2, () => db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://x.test', 'k', 'a')`, [U(2)]))).rejects.toThrow();
    await expect(register(2, 'http://not-https.test')).rejects.toThrow();
  });

  it('lets me remove my browser', async () => {
    await as(3, () => db.query('select public.unregister_push_subscription($1)', ['https://push.example.test/a']));
    expect(await count(3)).toBe(0);
  });
});
