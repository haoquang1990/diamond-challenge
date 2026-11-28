-- Story 069: friends. A friendship joins two accounts (not households), needs both to agree, and
-- reveals nothing about whether an Amway code exists: a request by code always answers 'sent'.
-- A request by code goes to every current member of that household. Writes only through the
-- functions below; each account reads only its own friendships.

insert into public.app_config (key, value) values ('friends_max', '50') on conflict (key) do nothing;

create table public.friendships (
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_a, user_b),
  constraint friendships_ordered check (user_a < user_b),
  constraint friendships_requester check (requested_by in (user_a, user_b))
);
create index friendships_user_b_idx on public.friendships (user_b);

alter table public.friendships enable row level security;
revoke all on table public.friendships from anon, authenticated;
grant select on table public.friendships to authenticated;
create policy "own friendships" on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create table public.friend_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);
alter table public.friend_tokens enable row level security;
revoke all on table public.friend_tokens from anon, authenticated;

create function public.friends_max()
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::integer from public.app_config where key = 'friends_max'), 50);
$$;

-- Friendships that count against my limit: accepted ones and the requests I sent.
create function public.my_friend_count(p_me uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer from public.friendships
  where p_me in (user_a, user_b) and (status = 'accepted' or requested_by = p_me);
$$;

-- Asks `p_target` (accepts when they already asked me). Internal: callers check the limit.
create function public.friend_request_to(p_me uuid, p_target uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  a uuid := least(p_me, p_target);
  b uuid := greatest(p_me, p_target);
  existing public.friendships%rowtype;
begin
  if p_target is null or p_target = p_me then
    return;
  end if;
  select * into existing from public.friendships where user_a = a and user_b = b for update;
  if found then
    if existing.status = 'pending' and existing.requested_by = p_target then
      update public.friendships set status = 'accepted', accepted_at = now() where user_a = a and user_b = b;
    end if;
    return;
  end if;
  insert into public.friendships (user_a, user_b, requested_by) values (a, b, p_me) on conflict do nothing;
end;
$$;

-- Returns 'sent' | 'invalid' | 'limit'. 'sent' also for a code nobody holds.
create function public.request_friend_by_code(p_code text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  v_code text := public.normalize_amway_code(p_code);
  v_household uuid;
  r record;
begin
  if me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if v_code is null then
    return 'invalid';
  end if;
  if public.my_friend_count(me) >= public.friends_max() then
    return 'limit';
  end if;
  select c.household_id into v_household
    from public.household_codes c join public.households h on h.id = c.household_id
    where c.code = v_code and c.status = 'active' and h.status = 'active';
  if v_household is null then
    return 'sent';
  end if;
  -- My own household: those are vợ/chồng, not friends.
  if exists (select 1 from public.household_members where household_id = v_household and user_id = me and left_at is null) then
    return 'sent';
  end if;
  for r in select user_id from public.household_members where household_id = v_household and left_at is null loop
    perform public.friend_request_to(me, r.user_id);
  end loop;
  return 'sent';
end;
$$;

-- My invite link token, created on first use.
create function public.my_friend_token()
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  v text;
begin
  if me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select token into v from public.friend_tokens where user_id = me;
  if v is null then
    v := replace(gen_random_uuid()::text, '-', '');
    insert into public.friend_tokens (user_id, token) values (me, v);
  end if;
  return v;
end;
$$;

-- Returns 'sent' | 'limit'; 'sent' also for an unknown token.
create function public.request_friend_by_token(p_token text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  v_target uuid;
begin
  if me is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if public.my_friend_count(me) >= public.friends_max() then
    return 'limit';
  end if;
  select user_id into v_target from public.friend_tokens where token = p_token;
  perform public.friend_request_to(me, v_target);
  return 'sent';
end;
$$;

-- Accepts or declines a request `p_other` sent me. Returns 'ok' | 'not_found' | 'limit'.
create function public.respond_friend(p_other uuid, p_accept boolean)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  a uuid := least(me, p_other);
  b uuid := greatest(me, p_other);
begin
  if not exists (select 1 from public.friendships where user_a = a and user_b = b and status = 'pending' and requested_by = p_other) then
    return 'not_found';
  end if;
  if not p_accept then
    delete from public.friendships where user_a = a and user_b = b;
    return 'ok';
  end if;
  if public.my_friend_count(me) >= public.friends_max() then
    return 'limit';
  end if;
  update public.friendships set status = 'accepted', accepted_at = now() where user_a = a and user_b = b;
  return 'ok';
end;
$$;

-- Ends a friendship or withdraws my request. Returns 'ok' | 'not_found'.
create function public.remove_friend(p_other uuid)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  delete from public.friendships where user_a = least(me, p_other) and user_b = greatest(me, p_other);
  return case when found then 'ok' else 'not_found' end;
end;
$$;

-- My friendships with what each side may see: name and household code once accepted, and for a
-- request I received; nothing about the account behind a request I sent.
create function public.my_friends()
returns table (friend_id uuid, status text, incoming boolean, display_name text, code text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select o.id,
         f.status,
         f.status = 'pending' and f.requested_by <> (select auth.uid()),
         case when f.status = 'accepted' or f.requested_by <> (select auth.uid()) then p.display_name end,
         case when f.status = 'accepted' or f.requested_by <> (select auth.uid()) then (
           select c.code from public.household_members m join public.household_codes c on c.household_id = m.household_id and c.status = 'active'
           where m.user_id = o.id and m.left_at is null limit 1
         ) end,
         f.created_at
  from public.friendships f
  cross join lateral (select case when f.user_a = (select auth.uid()) then f.user_b else f.user_a end as id) o
  left join public.profiles p on p.id = o.id
  where (select auth.uid()) in (f.user_a, f.user_b);
$$;

revoke all on function public.friends_max(), public.my_friend_count(uuid), public.friend_request_to(uuid, uuid) from public, anon, authenticated;
revoke all on function public.request_friend_by_code(text), public.my_friend_token(), public.request_friend_by_token(text),
  public.respond_friend(uuid, boolean), public.remove_friend(uuid), public.my_friends() from public, anon;
grant execute on function public.request_friend_by_code(text), public.my_friend_token(), public.request_friend_by_token(text),
  public.respond_friend(uuid, boolean), public.remove_friend(uuid), public.my_friends() to authenticated;
