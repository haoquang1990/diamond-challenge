-- Story 019: accounts, sponsor tree and aggregate numbers (design/quick-specs/supabase-accounts-2026-11-06.md).
-- Profiles are created only by Edge Functions (service role). Clients read themselves and
-- their downline, write only their own aggregates, and never change role, sponsor or phone.
-- No names or contacts are stored here: only phone (the login) and counts.

-- ---------------------------------------------------------------- tables
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text not null unique check (phone ~ '^\+[1-9][0-9]{8,14}$'),
  sponsor_id uuid references public.profiles (id) on delete set null,
  role text not null default 'user' check (role in ('user', 'admin')),
  must_change_password boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint profiles_not_own_sponsor check (sponsor_id is null or sponsor_id <> id)
);
create index profiles_sponsor_id_idx on public.profiles (sponsor_id);

create table public.aggregates (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  customers integer not null default 0 check (customers >= 0),
  f1 integer not null default 0 check (f1 >= 0),
  achieved_30x30 boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers
-- True when the signed-in user is an admin.
create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- True when `target` is the signed-in user or somewhere below them in the sponsor tree.
-- Walks up from `target`; the cycle trigger keeps the walk finite, the depth cap is a backstop.
create function public.is_self_or_downline(target uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  with recursive up as (
    select p.id, p.sponsor_id, 0 as depth from public.profiles p where p.id = target
    union all
    select p.id, p.sponsor_id, up.depth + 1
    from public.profiles p join up on p.id = up.sponsor_id
    where up.depth < 10000
  )
  select (select auth.uid()) is not null
     and exists (select 1 from up where up.id = (select auth.uid()));
$$;

-- Rejects a sponsor that is the profile itself or anyone below it.
create function public.profiles_reject_sponsor_cycle()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.sponsor_id is null then
    return new;
  end if;
  if exists (
    with recursive up as (
      select p.id, p.sponsor_id, 0 as depth from public.profiles p where p.id = new.sponsor_id
      union all
      select p.id, p.sponsor_id, up.depth + 1
      from public.profiles p join up on p.id = up.sponsor_id
      where up.depth < 10000
    )
    select 1 from up where up.id = new.id
  ) then
    raise exception 'sponsor cycle: % cannot be sponsored by %', new.id, new.sponsor_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger profiles_reject_sponsor_cycle
before insert or update of sponsor_id on public.profiles
for each row execute function public.profiles_reject_sponsor_cycle();

create function public.aggregates_touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger aggregates_touch_updated_at
before insert or update on public.aggregates
for each row execute function public.aggregates_touch_updated_at();

-- ---------------------------------------------------------------- RPCs
-- Called by the app after the user sets their own password on first sign-in.
create function public.mark_password_changed()
returns void
language sql volatile security definer set search_path = ''
as $$
  update public.profiles set must_change_password = false where id = (select auth.uid());
$$;

-- Admin only: change who sponsors a user (null makes them a root). Cycles are rejected by trigger.
create function public.set_sponsor(p_user uuid, p_sponsor uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only an admin can change a sponsor' using errcode = '42501';
  end if;
  update public.profiles set sponsor_id = p_sponsor where id = p_user;
  if not found then
    raise exception 'no profile %', p_user using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------- privileges
-- Supabase grants everything on new public tables and functions by default; narrow it.
revoke all on table public.profiles, public.aggregates from anon, authenticated;
grant select on table public.profiles to authenticated;
grant select, insert, update on table public.aggregates to authenticated;

revoke execute on function
  public.is_admin(), public.is_self_or_downline(uuid), public.mark_password_changed(),
  public.set_sponsor(uuid, uuid), public.profiles_reject_sponsor_cycle(),
  public.aggregates_touch_updated_at()
from public, anon;
grant execute on function
  public.is_admin(), public.is_self_or_downline(uuid), public.mark_password_changed(),
  public.set_sponsor(uuid, uuid)
to authenticated;

-- ---------------------------------------------------------------- row level security
alter table public.profiles enable row level security;
alter table public.aggregates enable row level security;

create policy "read self, downline, or all as admin"
on public.profiles for select to authenticated
using (public.is_admin() or public.is_self_or_downline(id));

create policy "read self, downline, or all as admin"
on public.aggregates for select to authenticated
using (public.is_admin() or public.is_self_or_downline(user_id));

create policy "insert own aggregates"
on public.aggregates for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "update own aggregates"
on public.aggregates for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
