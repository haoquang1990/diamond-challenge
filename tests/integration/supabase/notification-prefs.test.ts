// Story 058: `notification_prefs` (cheer pushes on/off, daily reminder on/off, time and time zone)
// is one row per account, read and written only by its owner. Applies every migration.
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

const save = (n: number, prefs: string) => as(n, () => db.query(`insert into public.notification_prefs (user_id, cheers, reminder_enabled, reminder_time, time_zone) values ($1, ${prefs}) on conflict (user_id) do update set user_id = excluded.user_id, cheers = excluded.cheers, reminder_enabled = excluded.reminder_enabled, reminder_time = excluded.reminder_time, time_zone = excluded.time_zone`, [U(n)]));
const mine = (n: number) => as(n, () => db.query<{ user_id: string; cheers: boolean; reminder_time: string }>('select user_id, cheers, reminder_time::text from public.notification_prefs'));

describe('notification_prefs (story 058)', () => {
  it('stores my settings and changes them', async () => {
    await save(2, "true, true, '18:45', 'Asia/Ho_Chi_Minh'");
    await save(2, "false, true, '19:00', 'Asia/Ho_Chi_Minh'");
    const rows = (await mine(2)).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ cheers: false, reminder_time: '19:00:00' });
  });

  it('cannot move my row to another account', async () => {
    await expect(as(2, () => db.query('update public.notification_prefs set user_id = $1 where user_id = $2', [U(3), U(2)]))).rejects.toThrow();
  });

  it('is invisible to and not writable by another account', async () => {
    expect((await mine(3)).rows).toHaveLength(0);
    await expect(as(3, () => db.query(`insert into public.notification_prefs (user_id, cheers) values ($1, true)`, [U(2)]))).rejects.toThrow();
  });

  it('refuses a time zone that is not a name and lets nobody set when the last reminder went out', async () => {
    await expect(save(3, "true, true, '18:00', 'x; drop table y'")).rejects.toThrow();
    await expect(as(2, () => db.query(`update public.notification_prefs set last_reminded_on = current_date where user_id = $1`, [U(2)]))).rejects.toThrow();
  });
});
