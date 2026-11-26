-- Story 050: more shared numbers so a sponsor can cheer and remind at the right time. Still only
-- totals of the account's own activity, never Danh bạ data:
-- today's goal, active days and task counts of the last 7 days, lessons learned, latest lesson,
-- badges earned in 7 days, and when the app last sent them (last_seen_at).
-- Plus `f1_member_activation`: whether accounts of my direct F1 households (and of my own
-- household) have changed their first password yet.

alter table public.member_progress
  add column stats_day date,
  add column goal_today boolean not null default false,
  add column active_days_7d integer not null default 0 check (active_days_7d between 0 and 7),
  add column tasks_7d jsonb not null default '{}'::jsonb check (jsonb_typeof(tasks_7d) = 'object'),
  add column lessons_distinct integer not null default 0 check (lessons_distinct >= 0),
  add column last_lesson_at timestamptz,
  add column badges_7d integer not null default 0 check (badges_7d >= 0),
  add column last_seen_at timestamptz;

-- Activation state of the given accounts, only for members of my own household or of a household
-- my household directly sponsors (admins: any). Others are left out of the result.
create function public.f1_member_activation(p_user_ids uuid[])
returns table (user_id uuid, activated boolean)
language sql stable security definer set search_path = ''
as $$
  select p.id, not p.must_change_password
  from public.profiles p
  join public.household_members m on m.user_id = p.id and m.left_at is null
  join public.households h on h.id = m.household_id
  where p.id = any(p_user_ids)
    and (
      public.is_admin()
      or public.is_household_member(h.id)
      or (h.sponsor_household_id is not null and public.is_household_member(h.sponsor_household_id))
    );
$$;

revoke execute on function public.f1_member_activation(uuid[]) from public, anon;
grant execute on function public.f1_member_activation(uuid[]) to authenticated;
