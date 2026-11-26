// Story 049: cheers carry a server-set sender name and may go to the spouse in the same NPP
// (`to_user_id`). Sponsor cheers keep their rules. Applies every migration in order on in-memory
// Postgres (PGlite) and checks as the `authenticated` role.
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


// Tree: A (users 2 and 7, root) -> B (user 3); user 6 is an unrelated root.
let A: string, B: string, X: string;

const cheer = (n: number, from: string, to: string, toUser: number | null = null, message = 'Cố lên!') =>
  as(n, () =>
    db.query('insert into public.cheers (from_household_id, to_household_id, to_user_id, message) values ($1, $2, $3, $4)', [from, to, toUser === null ? null : U(toUser), message]),
  );

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
  X = await provision(6, null, '2000006', 1);
  await db.query('insert into auth.users values ($1, $2)', [U(7), 'u7']);
  await db.query(`insert into public.profiles (id, phone, display_name, must_change_password) values ($1, '+84900000007', 'Chị Mai', false)`, [U(7)]);
  await db.query('insert into public.household_members (household_id, user_id) values ($1, $2)', [A, U(7)]);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('cheers with sender name and spouse (story 049)', () => {
  it('keeps sponsor cheers working and names the sender from the profile', async () => {
    await cheer(2, A, B);
    const row = await as(3, () => db.query<{ sender_name: string | null; to_user_id: string | null }>('select sender_name, to_user_id from public.cheers where to_household_id = $1', [B]));
    expect(row.rows).toEqual([{ sender_name: 'User 2', to_user_id: null }]);
    await expect(cheer(2, A, B)).rejects.toThrow(/already/);
  });

  it('lets a member cheer the spouse once a day, read by the household', async () => {
    await cheer(7, A, A, 2, 'Anh giỏi lắm!');
    await expect(cheer(7, A, A, 2)).rejects.toThrow(/already/);
    const seen = await as(2, () => one<string>('select sender_name as v from public.cheers where to_user_id = $1', [U(2)]));
    expect(seen).toBe('Chị Mai');
    await cheer(2, A, A, 7); // the other way is its own daily cheer
  });

  it('refuses cheering yourself, someone outside the household, or a spouse of another NPP', async () => {
    await expect(cheer(2, A, A, 2)).rejects.toThrow();
    await expect(cheer(2, A, A, 3)).rejects.toThrow();
    await expect(cheer(6, X, A, 2)).rejects.toThrow();
    await expect(cheer(3, B, A, 2)).rejects.toThrow();
  });

  it('cannot fake the sender name', async () => {
    await as(3, () => db.query("insert into public.cheers (from_household_id, to_household_id, message, sender_name) values ($1, $2, 'x', 'Giả mạo')", [B, B]).catch(() => null));
    await as(2, () => db.query("insert into public.cheers (from_household_id, to_household_id, message, sender_name) values ($1, $2, 'Hi', 'Giả mạo')", [A, B]).catch(() => null));
    const names = await as(3, () => db.query<{ sender_name: string }>('select sender_name from public.cheers where to_household_id = $1', [B]));
    expect(names.rows.every((r) => r.sender_name !== 'Giả mạo')).toBe(true);
  });
});
