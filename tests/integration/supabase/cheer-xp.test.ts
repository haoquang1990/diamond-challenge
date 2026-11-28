// Story 070: personal_events stores `cheer_sent` (cheering earns XP) and still rejects unknown types. Applies every migration in order on in-memory Postgres (PGlite).
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

let db: PGlite;
const insert = async (id: string, type: string) => {
  await db.query(`insert into auth.users values ('00000000-0000-0000-0000-000000000001', 'u1') on conflict do nothing`);
  await db.query(`insert into public.profiles (id, phone, must_change_password) values ('00000000-0000-0000-0000-000000000001', '+84911111111', false) on conflict do nothing`);
  return db.query(`insert into public.personal_events (id, user_id, type, occurred_at, payload) values ($1, '00000000-0000-0000-0000-000000000001', $2, now(), '{"xp":5}'::jsonb)`, [id, type]);
};

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of Object.keys(MIGRATIONS).sort()) await db.exec(MIGRATIONS[file] ?? '');
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('personal_events type check (story 070)', () => {
  it('accepts cheer_sent', async () => {
    await expect(insert('50000000-0000-0000-0000-000000000001', 'cheer_sent')).resolves.toBeDefined();
  });

  it('still accepts an existing type and rejects an unknown one', async () => {
    await expect(insert('50000000-0000-0000-0000-000000000002', 'lesson_completed')).resolves.toBeDefined();
    await expect(insert('50000000-0000-0000-0000-000000000003', 'something_else')).rejects.toThrow(/personal_events_type_check/);
  });
});
