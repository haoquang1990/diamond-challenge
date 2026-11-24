-- Story 044: each account shares three progress numbers so its sponsor can rank active NPPs:
-- total XP, XP of the last 7 local days and the current streak. One row per account, written
-- only by that account; readable by the account's own household, its upline chain and admins
-- (the same reach as household_members). No event and no personal data beyond the numbers.

create table public.member_progress (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  xp_total integer not null default 0 check (xp_total >= 0),
  xp_7d integer not null default 0 check (xp_7d >= 0),
  streak integer not null default 0 check (streak >= 0),
  updated_at timestamptz not null default now()
);

create function public.member_progress_touch()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger member_progress_touch
before insert or update on public.member_progress
for each row execute function public.member_progress_touch();

-- True when the caller may see `u`'s numbers: u is in a household the caller can view.
create function public.can_view_member(u uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.user_id = u and m.left_at is null and public.can_view_household(m.household_id)
  );
$$;

revoke all on table public.member_progress from public, anon, authenticated;
grant select, insert, update on table public.member_progress to authenticated;
revoke execute on function public.can_view_member(uuid) from public, anon;
grant execute on function public.can_view_member(uuid) to authenticated;
revoke execute on function public.member_progress_touch() from public, anon, authenticated;

alter table public.member_progress enable row level security;

create policy "read own household and downline" on public.member_progress for select to authenticated
using (user_id = (select auth.uid()) or public.can_view_member(user_id));
create policy "write own numbers" on public.member_progress for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "update own numbers" on public.member_progress for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
