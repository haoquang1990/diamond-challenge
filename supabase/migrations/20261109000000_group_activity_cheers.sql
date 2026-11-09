-- Story 028 "Nhóm của tôi" (design/gdd/accounts.md rules 24-28): last activity of a household
-- (the sponsor sees only a timestamp, never event content) and cheers from a sponsor household
-- to its direct F1 households.

-- ================================================================ last activity
alter table public.households add column last_activity_at timestamptz;

-- A new `activity_logged` event in a household's contact book stamps the household. Compensations
-- (undo of an activity) are not activity. Runs as the owner: app roles have no update grant on
-- households. A separate AFTER INSERT trigger, so the BEFORE trigger that assigns sync_seq is untouched.
create function public.households_stamp_activity()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.type = 'activity_logged' and new.household_id is not null and not (new.payload ? 'compensates') then
    update public.households
      set last_activity_at = greatest(coalesce(last_activity_at, '-infinity'::timestamptz), now())
      where id = new.household_id;
  end if;
  return null;
end;
$$;

create trigger contact_events_stamp_activity
after insert on public.contact_events
for each row execute function public.households_stamp_activity();

-- ================================================================ cheers
insert into public.app_config (key, value) values ('cheers_per_day', '1');

create function public.cheers_per_day()
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::integer from public.app_config where key = 'cheers_per_day'), 1);
$$;

-- True when household `sponsor` is the DIRECT sponsor of the active household `target`.
create function public.is_direct_sponsor_household(sponsor uuid, target uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.households
    where id = target and sponsor_household_id = sponsor and status = 'active'
  );
$$;

-- cheer_day is the UTC calendar date of created_at (the day boundary is 00:00 UTC, 07:00 in Vietnam).
create table public.cheers (
  id uuid primary key default gen_random_uuid(),
  from_household_id uuid not null references public.households (id) on delete cascade,
  to_household_id uuid not null references public.households (id) on delete cascade,
  sent_by uuid default auth.uid() references public.profiles (id) on delete set null,
  message text not null check (char_length(btrim(message)) between 1 and 200),
  created_at timestamptz not null default now(),
  cheer_day date not null default (now() at time zone 'utc')::date,
  constraint cheers_not_to_self check (from_household_id <> to_household_id)
);
create index cheers_to_idx on public.cheers (to_household_id, created_at desc);
create index cheers_day_idx on public.cheers (to_household_id, from_household_id, cheer_day);

-- Fixes the server clock fields and allows at most cheers_per_day cheers per (to, from, UTC day).
-- The target household row is locked so two concurrent cheers cannot both pass.
create function public.cheers_enforce_daily_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.created_at := now();
  new.cheer_day := (now() at time zone 'utc')::date;
  -- Not the direct sponsor: leave the refusal to RLS, so the limit check cannot reveal whether
  -- another household cheered this one today.
  if not (public.is_household_member(new.from_household_id)
          and public.is_direct_sponsor_household(new.from_household_id, new.to_household_id)) then
    return new;
  end if;
  perform 1 from public.households where id = new.to_household_id for update;
  if (select count(*) from public.cheers
      where to_household_id = new.to_household_id and from_household_id = new.from_household_id
        and cheer_day = new.cheer_day) >= public.cheers_per_day() then
    raise exception 'household % already received % cheer(s) from % today',
      new.to_household_id, public.cheers_per_day(), new.from_household_id using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger cheers_enforce_daily_limit
before insert on public.cheers
for each row execute function public.cheers_enforce_daily_limit();

-- ================================================================ privileges
revoke all on table public.cheers from anon, authenticated;
grant select, insert on table public.cheers to authenticated;

revoke execute on function
  public.households_stamp_activity(), public.cheers_per_day(), public.is_direct_sponsor_household(uuid, uuid),
  public.cheers_enforce_daily_limit()
from public, anon, authenticated;
grant execute on function public.is_direct_sponsor_household(uuid, uuid) to authenticated;

-- ================================================================ row level security
alter table public.cheers enable row level security;

-- only a member of the DIRECT sponsor household writes, and only as themselves
create policy "sponsor members send cheers" on public.cheers for insert to authenticated
with check (
  public.is_household_member(from_household_id)
  and public.is_direct_sponsor_household(from_household_id, to_household_id)
  and sent_by = (select auth.uid())
);

-- only the sending and the receiving household read; no update or delete policy exists
create policy "sender and receiver read cheers" on public.cheers for select to authenticated
using (public.is_household_member(from_household_id) or public.is_household_member(to_household_id));
