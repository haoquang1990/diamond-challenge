// Story 065: the migration lets `contact_events` store `activity_note_changed` (and still
// `sponsorship_cancelled`) and still rejects unknown types. Applies every migration in order on in-memory Postgres (PGlite).
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
const insert = (id: string, type: string) =>
  db.query(`insert into public.contact_events (id, household_id, type, occurred_at, payload) values ($1, null, $2, now(), '{"personId":"p1"}'::jsonb)`, [id, type]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of Object.keys(MIGRATIONS).sort()) await db.exec(MIGRATIONS[file] ?? '');
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('contact_events type check (story 065)', () => {
  it('accepts activity_note_changed and sponsorship_cancelled', async () => {
    await expect(insert('40000000-0000-0000-0000-000000000001', 'activity_note_changed')).resolves.toBeDefined();
    await expect(insert('40000000-0000-0000-0000-000000000004', 'sponsorship_cancelled')).resolves.toBeDefined();
  });

  it('still accepts an existing type and rejects an unknown one', async () => {
    await expect(insert('40000000-0000-0000-0000-000000000002', 'person_added')).resolves.toBeDefined();
    await expect(insert('40000000-0000-0000-0000-000000000003', 'something_else')).rejects.toThrow(/contact_events_type_check/);
  });
});
