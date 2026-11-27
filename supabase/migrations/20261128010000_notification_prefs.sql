-- Story 058: notification settings per account, so the server can push the daily reminder while
-- the app is closed and skip cheer pushes for someone who turned them off.
--
-- * One row per account; only its owner reads and writes it (cheers, reminder on/off, time, zone).
-- * `last_reminded_on` is written only by the send-reminders Edge Function (service role), so a
--   reminder goes out at most once a local day.

create table public.notification_prefs (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  cheers boolean not null default true,
  reminder_enabled boolean not null default false,
  reminder_time time not null default '20:00',
  time_zone text not null default 'Asia/Ho_Chi_Minh' check (time_zone ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+){0,2}$' and length(time_zone) <= 64),
  last_reminded_on date,
  updated_at timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;
create policy "owners read their notification prefs" on public.notification_prefs for select to authenticated
  using (user_id = (select auth.uid()));
create policy "owners add their notification prefs" on public.notification_prefs for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "owners change their notification prefs" on public.notification_prefs for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.notification_prefs from anon, authenticated;
grant select on public.notification_prefs to authenticated;
grant insert (user_id, cheers, reminder_enabled, reminder_time, time_zone) on public.notification_prefs to authenticated;
grant update (user_id, cheers, reminder_enabled, reminder_time, time_zone) on public.notification_prefs to authenticated;

create function public.notification_prefs_touch()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger notification_prefs_touch before update on public.notification_prefs
  for each row execute function public.notification_prefs_touch();

create index notification_prefs_reminder_idx on public.notification_prefs (reminder_enabled) where reminder_enabled;
