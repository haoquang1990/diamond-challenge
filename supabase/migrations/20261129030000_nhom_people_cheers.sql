-- Story 070: the Nhóm on Hôm nay. nhom_people() lists my vợ/chồng, tuyến trên (my sponsor
-- household), tuyến dưới (my F1 households) and bạn bè with their shared numbers (streak, today's
-- goal, XP of 7 days) and whether I already cheered them today. Cheers also go to a friend
-- (to_user_id = the friend) and to my sponsor household (to_user_id null), once per UTC day.

create function public.are_friends(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.friendships
    where user_a = least(a, b) and user_b = greatest(a, b) and status = 'accepted'
  );
$$;

-- True when `u` is an active member of active household `h`.
create function public.is_active_member_of(h uuid, u uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m join public.households x on x.id = m.household_id
    where m.household_id = h and m.user_id = u and m.left_at is null and x.status = 'active'
  );
$$;

alter table public.cheers drop constraint cheers_not_to_self;
alter table public.cheers add constraint cheers_not_to_self check (
  (to_user_id is null and from_household_id <> to_household_id) or to_user_id is not null
);

create or replace function public.cheers_enforce_daily_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  new.created_at := now();
  new.cheer_day := (now() at time zone 'utc')::date;
  new.sender_name := (
    select coalesce(nullif(btrim(display_name), ''), phone) from public.profiles where id = me
  );
  if new.to_user_id is null then
    -- Household cheer: to my F1 (sponsor cheer) or, since story 070, to my sponsor. Anything else
    -- is left to RLS, so the limit check cannot reveal whether another household cheered.
    if not (public.is_household_member(new.from_household_id)
            and (public.is_direct_sponsor_household(new.from_household_id, new.to_household_id)
                 or public.is_direct_sponsor_household(new.to_household_id, new.from_household_id))) then
      return new;
    end if;
    perform 1 from public.households where id = new.to_household_id for update;
    if (select count(*) from public.cheers
        where to_household_id = new.to_household_id and from_household_id = new.from_household_id
          and to_user_id is null and cheer_day = new.cheer_day) >= public.cheers_per_day() then
      raise exception 'household % already received % cheer(s) from % today',
        new.to_household_id, public.cheers_per_day(), new.from_household_id using errcode = '23505';
    end if;
    return new;
  end if;
  -- Spouse or friend cheer.
  if not (public.is_spouse_in_household(new.from_household_id, new.to_user_id)
          or (public.is_household_member(new.from_household_id)
              and public.are_friends(me, new.to_user_id)
              and public.is_active_member_of(new.to_household_id, new.to_user_id))) then
    return new;
  end if;
  perform 1 from public.households where id = new.to_household_id for update;
  if (select count(*) from public.cheers
      where to_user_id = new.to_user_id and sent_by = me and cheer_day = new.cheer_day)
      >= public.cheers_per_day() then
    raise exception 'member % already received % cheer(s) today', new.to_user_id, public.cheers_per_day()
      using errcode = '23505';
  end if;
  return new;
end;
$$;

drop policy "sponsor members send cheers" on public.cheers;
create policy "sponsor members send cheers" on public.cheers for insert to authenticated
with check (
  sent_by = (select auth.uid())
  and (
    (to_user_id is null
      and public.is_household_member(from_household_id)
      and (public.is_direct_sponsor_household(from_household_id, to_household_id)
           or public.is_direct_sponsor_household(to_household_id, from_household_id)))
    or (to_user_id is not null
      and from_household_id = to_household_id
      and public.is_spouse_in_household(from_household_id, to_user_id))
    or (to_user_id is not null
      and from_household_id <> to_household_id
      and public.is_household_member(from_household_id)
      and public.are_friends((select auth.uid()), to_user_id)
      and public.is_active_member_of(to_household_id, to_user_id))
  )
);

-- The friend I cheered reads that cheer even when no one of its household sent or got it before.
create policy "friend receiver reads cheers" on public.cheers for select to authenticated
using (to_user_id = (select auth.uid()));

create function public.nhom_people()
returns table (
  user_id uuid, relation text, household_id uuid, display_name text, code text,
  streak integer, goal_today boolean, stats_day date, xp_7d integer, last_seen_at timestamptz, cheered_today boolean
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
         end
  from best b
  left join public.profiles p on p.id = b.user_id
  left join public.member_progress mp on mp.user_id = b.user_id;
$$;

revoke all on function public.are_friends(uuid, uuid), public.is_active_member_of(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid), public.is_active_member_of(uuid, uuid) to authenticated;
revoke all on function public.nhom_people() from public, anon;
grant execute on function public.nhom_people() to authenticated;
