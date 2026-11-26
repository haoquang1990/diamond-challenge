-- Story 049: cheers name their sender and can go to the spouse in the same NPP.
--
-- * `sender_name`: set by the server from the sender's profile (display name, else phone), so
--   the receiver sees who cheered without reading upline profiles, and nobody can fake it.
-- * `to_user_id`: the receiving member of a cheer inside one NPP (spouse to spouse). Sponsor
--   cheers keep `to_user_id` null and the old rules (direct sponsor, cheers_per_day per day).
-- * A spouse cheer: same household on both sides, the receiver is another active member of the
--   sender's household, at most cheers_per_day per (sender, receiver, UTC day).
-- * The message stays 1-200 characters (the app now lets the sender pick or type it).

alter table public.cheers add column to_user_id uuid references public.profiles (id) on delete cascade;
alter table public.cheers add column sender_name text;

alter table public.cheers drop constraint cheers_not_to_self;
alter table public.cheers add constraint cheers_not_to_self check (
  (to_user_id is null and from_household_id <> to_household_id)
  or (to_user_id is not null and from_household_id = to_household_id)
);
create index cheers_to_user_idx on public.cheers (to_user_id, cheer_day) where to_user_id is not null;

-- True when `u` is another active member of household `h` than the caller, and the caller is one.
create function public.is_spouse_in_household(h uuid, u uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_household_member(h) and u <> (select auth.uid()) and exists (
    select 1 from public.household_members where household_id = h and user_id = u and left_at is null
  );
$$;

create or replace function public.cheers_enforce_daily_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.created_at := now();
  new.cheer_day := (now() at time zone 'utc')::date;
  new.sender_name := (
    select coalesce(nullif(btrim(display_name), ''), phone) from public.profiles where id = (select auth.uid())
  );
  if new.to_user_id is null then
    -- Sponsor cheer. Not the direct sponsor: leave the refusal to RLS, so the limit check cannot
    -- reveal whether another household cheered this one today.
    if not (public.is_household_member(new.from_household_id)
            and public.is_direct_sponsor_household(new.from_household_id, new.to_household_id)) then
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
  -- Spouse cheer.
  if not public.is_spouse_in_household(new.from_household_id, new.to_user_id) then
    return new;
  end if;
  perform 1 from public.households where id = new.to_household_id for update;
  if (select count(*) from public.cheers
      where to_user_id = new.to_user_id and sent_by = (select auth.uid()) and cheer_day = new.cheer_day)
      >= public.cheers_per_day() then
    raise exception 'member % already received % cheer(s) today', new.to_user_id, public.cheers_per_day()
      using errcode = '23505';
  end if;
  return new;
end;
$$;

revoke execute on function public.is_spouse_in_household(uuid, uuid) from public, anon;
grant execute on function public.is_spouse_in_household(uuid, uuid) to authenticated;

drop policy "sponsor members send cheers" on public.cheers;
create policy "sponsor members send cheers" on public.cheers for insert to authenticated
with check (
  sent_by = (select auth.uid())
  and (
    (to_user_id is null
      and public.is_household_member(from_household_id)
      and public.is_direct_sponsor_household(from_household_id, to_household_id))
    or (to_user_id is not null
      and from_household_id = to_household_id
      and public.is_spouse_in_household(from_household_id, to_user_id))
  )
);
