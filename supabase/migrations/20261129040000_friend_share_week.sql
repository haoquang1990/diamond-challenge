-- Story 071: "Chia sẻ với bạn bè" and the weekly ranking.
-- * friend_share: my two switches (tasks of 7 days, KH / NPP counts), off by default; owner-only.
-- * member_progress.xp_week / week_start: XP since Monday (my local week), sent by the app.
-- * nhom_people() also returns xp_week, week_start and, by the rules above, tasks_7d, customers, f1.

alter table public.member_progress
  add column xp_week integer not null default 0 check (xp_week >= 0),
  add column week_start date;

create table public.friend_share (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  tasks boolean not null default false,
  counts boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.friend_share enable row level security;
revoke all on table public.friend_share from anon, authenticated;
grant select, insert, update on table public.friend_share to authenticated;
create policy "own share switches read" on public.friend_share for select to authenticated using (user_id = (select auth.uid()));
create policy "own share switches insert" on public.friend_share for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own share switches update" on public.friend_share for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop function public.nhom_people();
create function public.nhom_people()
returns table (
  user_id uuid, relation text, household_id uuid, display_name text, code text,
  streak integer, goal_today boolean, stats_day date, xp_7d integer, last_seen_at timestamptz, cheered_today boolean,
  xp_week integer, week_start date, tasks_7d jsonb, customers integer, f1 integer
)
language sql stable security definer set search_path = ''
as $$
  with me as (
    select (select auth.uid()) as id
  ), mine as (
    select m.household_id as id, h.sponsor_household_id as sponsor
    from public.household_members m join public.households h on h.id = m.household_id, me
    where m.user_id = me.id and m.left_at is null and h.status = 'active'
  ), linked as (
    select m.user_id, 'spouse'::text as relation, m.household_id, 1 as rank
      from public.household_members m, mine, me
      where m.household_id = mine.id and m.left_at is null and m.user_id <> me.id
    union all
    select m.user_id, 'upline', m.household_id, 2
      from public.household_members m join public.households h on h.id = m.household_id, mine
      where m.household_id = mine.sponsor and m.left_at is null and h.status = 'active'
    union all
    select m.user_id, 'downline', m.household_id, 3
      from public.household_members m join public.households h on h.id = m.household_id, mine
      where h.sponsor_household_id = mine.id and h.status = 'active' and m.left_at is null
    union all
    select m.user_id, 'friend', m.household_id, 4
      from public.friendships f, me
      cross join lateral (select case when f.user_a = me.id then f.user_b else f.user_a end as other) o
      join public.household_members m on m.user_id = o.other and m.left_at is null
      join public.households h on h.id = m.household_id and h.status = 'active'
      where me.id in (f.user_a, f.user_b) and f.status = 'accepted'
  ), best as (
    select distinct on (l.user_id) l.* from linked l, me where l.user_id <> me.id order by l.user_id, l.rank
  )
  select b.user_id, b.relation, b.household_id,
         p.display_name,
         (select c.code from public.household_codes c where c.household_id = b.household_id and c.status = 'active'),
         mp.streak, mp.goal_today, mp.stats_day, mp.xp_7d, mp.last_seen_at,
         case when b.relation in ('spouse', 'friend') then exists (
                select 1 from public.cheers c, me
                where c.to_user_id = b.user_id and c.sent_by = me.id and c.cheer_day = (now() at time zone 'utc')::date)
              else exists (
                select 1 from public.cheers c, mine
                where c.from_household_id = mine.id and c.to_household_id = b.household_id and c.to_user_id is null
                  and c.cheer_day = (now() at time zone 'utc')::date)
         end,
         mp.xp_week, mp.week_start,
         -- Tasks and KH / NPP counts: my spouse and F1s as before; a friend only with their switch on.
         case when b.relation in ('spouse', 'downline') or (b.relation = 'friend' and coalesce(fs.tasks, false)) then mp.tasks_7d end,
         case when b.relation in ('spouse', 'downline') or (b.relation = 'friend' and coalesce(fs.counts, false)) then ha.customers end,
         case when b.relation in ('spouse', 'downline') or (b.relation = 'friend' and coalesce(fs.counts, false)) then ha.f1 end
  from best b
  left join public.profiles p on p.id = b.user_id
  left join public.member_progress mp on mp.user_id = b.user_id
  left join public.friend_share fs on fs.user_id = b.user_id
  left join public.household_aggregates ha on ha.household_id = b.household_id;
$$;

revoke all on function public.nhom_people() from public, anon;
grant execute on function public.nhom_people() to authenticated;
