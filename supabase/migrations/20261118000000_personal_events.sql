-- Story 031 (ADR-0004): personal progress (lessons, XP, streak, achievements) is synced to the
-- server per account. Only the owner reads and writes these rows: no policy for admin,
-- household members or sponsors, and no update or delete for the app (an undo is a compensating event).

-- ================================================================ consent version on the server
-- Stored like max_household_members / cheers_per_day: a jsonb number. Story 033 raises this
-- together with `contactConsentVersion` in game-config.json.
insert into public.app_config (key, value) values ('contact_consent_version', '1');

create function public.contact_consent_version()
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::integer from public.app_config where key = 'contact_consent_version'), 1);
$$;

-- True when the caller has consented at the current version or a later one.
create function public.has_current_contact_consent()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.contact_consents
    where user_id = (select auth.uid()) and version >= public.contact_consent_version()
  );
$$;

-- ================================================================ table
-- `id` is made by the device, so a re-sent event (`on conflict (id) do nothing`) never doubles.
-- Known limit of the type checks: a compensating `activity_logged { compensates }` event passes
-- them, because the server cannot tell which stream (contact book or personal) its target belongs
-- to. The app classifies a compensation by the event it compensates (story 032).
create table public.personal_events (
  id uuid primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  type text not null,
  occurred_at timestamptz not null,
  schema_version integer not null default 1 check (schema_version > 0),
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  sync_seq bigint not null unique,
  constraint personal_events_type_check
    check (type in ('lesson_completed', 'activity_logged', 'settings_changed')),
  constraint personal_events_activity_not_contact
    check (type <> 'activity_logged' or not (payload ? 'personId')),
  constraint personal_events_settings_progress_only
    check (type <> 'settings_changed'
           or payload ?| array['achievementAcknowledged', 'stageAcknowledged', 'achievementsSeeded'])
);

create index personal_events_user_seq_idx on public.personal_events (user_id, sync_seq);

-- ================================================================ sync_seq
create sequence public.personal_events_sync_seq as bigint;

-- Runs as the owner so an app user's insert may use the sequence. A value sent by a client is ignored.
create function public.personal_events_assign_sync_seq()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.sync_seq := nextval('public.personal_events_sync_seq');
  return new;
end;
$$;

create trigger personal_events_assign_sync_seq
before insert on public.personal_events
for each row execute function public.personal_events_assign_sync_seq();

-- ================================================================ privileges
revoke all on sequence public.personal_events_sync_seq from public, anon, authenticated;
revoke all on table public.personal_events from public, anon, authenticated;
grant select, insert on table public.personal_events to authenticated;

revoke execute on function
  public.personal_events_assign_sync_seq(), public.contact_consent_version(), public.has_current_contact_consent()
from public, anon, authenticated;
grant execute on function public.has_current_contact_consent() to authenticated;

-- ================================================================ row level security
alter table public.personal_events enable row level security;

create policy "owner reads own personal events" on public.personal_events for select to authenticated
using (user_id = (select auth.uid()));

create policy "owner writes own personal events" on public.personal_events for insert to authenticated
with check (user_id = (select auth.uid()) and public.has_current_contact_consent());
