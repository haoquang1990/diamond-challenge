-- Stories 072-074: tuyến trên by Amway code. The link stays a household one
-- (households.sponsor_household_id); the code is only how it is found.
-- * 072 admin_set_sponsor_by_code: the admin sets or clears a household's sponsor.
-- * 073 upline requests: an account whose household has no sponsor asks one by code; any member
--   of that household accepts or declines. A request never tells whether the code exists.
-- * 074 downline_code_changes: tuyến trên learns an F1's new code after the old one was replaced.

-- ================================================================ 072
-- Returns 'ok' | 'not_found' | 'self' | 'cycle'. An empty code clears the sponsor (root).
create function public.admin_set_sponsor_by_code(p_household uuid, p_code text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_code text := public.normalize_amway_code(p_code);
  v_sponsor uuid;
begin
  perform public.require_admin();
  if coalesce(btrim(p_code), '') = '' then
    update public.households set sponsor_household_id = null where id = p_household;
    return case when found then 'ok' else 'not_found' end;
  end if;
  select c.household_id into v_sponsor
    from public.household_codes c join public.households h on h.id = c.household_id
    where c.code = v_code and c.status = 'active' and h.status = 'active';
  if v_sponsor is null then
    return 'not_found';
  end if;
  if v_sponsor = p_household then
    return 'self';
  end if;
  begin
    update public.households set sponsor_household_id = v_sponsor where id = p_household;
  exception when check_violation then
    return 'cycle';
  end;
  return case when found then 'ok' else 'not_found' end;
end;
$$;

-- ================================================================ 073
create table public.upline_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- null when the typed code matched nobody (or my own household): the request then never shows.
  sponsor_household_id uuid references public.households (id) on delete cascade,
  code text not null,
  requested_by uuid references auth.users (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index upline_requests_one_pending on public.upline_requests (household_id) where status = 'pending';
create index upline_requests_sponsor_idx on public.upline_requests (sponsor_household_id) where status = 'pending';
alter table public.upline_requests enable row level security;
revoke all on table public.upline_requests from anon, authenticated;

-- My active household (null when none).
create function public.my_household_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.household_id from public.household_members m join public.households h on h.id = m.household_id
  where m.user_id = (select auth.uid()) and m.left_at is null and h.status = 'active' limit 1;
$$;

-- Returns 'sent' | 'invalid' | 'has_upline' | 'no_household'; 'sent' also for a code nobody holds.
create function public.request_upline_by_code(p_code text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_mine uuid := public.my_household_id();
  v_code text := public.normalize_amway_code(p_code);
  v_target uuid;
begin
  if v_mine is null then
    return 'no_household';
  end if;
  if v_code is null then
    return 'invalid';
  end if;
  if (select sponsor_household_id from public.households where id = v_mine) is not null then
    return 'has_upline';
  end if;
  select c.household_id into v_target
    from public.household_codes c join public.households h on h.id = c.household_id
    where c.code = v_code and c.status = 'active' and h.status = 'active';
  if v_target = v_mine then
    v_target := null;
  end if;
  update public.upline_requests set status = 'cancelled', decided_at = now() where household_id = v_mine and status = 'pending';
  insert into public.upline_requests (household_id, sponsor_household_id, code, requested_by)
    values (v_mine, v_target, v_code, (select auth.uid()));
  return 'sent';
end;
$$;

create function public.cancel_upline_request()
returns text
language plpgsql volatile security definer set search_path = ''
as $$
begin
  update public.upline_requests set status = 'cancelled', decided_at = now()
    where household_id = public.my_household_id() and status = 'pending';
  return 'ok';
end;
$$;

-- My household's pending request: only the code I typed and when.
create function public.my_upline_request()
returns table (code text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select r.code, r.created_at from public.upline_requests r
  where r.household_id = public.my_household_id() and r.status = 'pending';
$$;

-- Requests to my household: who asks (names of its members) and their code.
create function public.upline_invites()
returns table (id uuid, household_id uuid, names text, code text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.household_id,
         (select string_agg(coalesce(nullif(btrim(p.display_name), ''), p.phone), ' & ' order by m.joined_at)
            from public.household_members m join public.profiles p on p.id = m.user_id
            where m.household_id = r.household_id and m.left_at is null),
         (select c.code from public.household_codes c where c.household_id = r.household_id and c.status = 'active'),
         r.created_at
  from public.upline_requests r
  where r.sponsor_household_id = public.my_household_id() and r.status = 'pending';
$$;

-- Returns 'ok' | 'not_found' | 'has_upline' | 'cycle'.
create function public.respond_upline(p_id uuid, p_accept boolean)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  r public.upline_requests%rowtype;
begin
  select * into r from public.upline_requests
    where id = p_id and status = 'pending' and sponsor_household_id = public.my_household_id() for update;
  if not found then
    return 'not_found';
  end if;
  if not p_accept then
    update public.upline_requests set status = 'declined', decided_at = now() where id = p_id;
    return 'ok';
  end if;
  if (select sponsor_household_id from public.households where id = r.household_id) is not null then
    update public.upline_requests set status = 'cancelled', decided_at = now() where id = p_id;
    return 'has_upline';
  end if;
  begin
    update public.households set sponsor_household_id = r.sponsor_household_id where id = r.household_id;
  exception when check_violation then
    return 'cycle';
  end;
  update public.upline_requests set status = 'accepted', decided_at = now() where id = p_id;
  return 'ok';
end;
$$;

-- ================================================================ 074
-- For each F1 household of mine whose code was replaced: the old code(s) and the active one.
create function public.downline_code_changes()
returns table (household_id uuid, old_code text, new_code text)
language sql stable security definer set search_path = ''
as $$
  select h.id, old.code, cur.code
  from public.households h
  join public.household_codes cur on cur.household_id = h.id and cur.status = 'active'
  join public.household_codes old on old.household_id = h.id and old.status = 'cancelled' and old.code <> cur.code
  where h.sponsor_household_id = public.my_household_id() and h.status = 'active';
$$;

revoke all on function public.admin_set_sponsor_by_code(uuid, text), public.my_household_id(), public.request_upline_by_code(text),
  public.cancel_upline_request(), public.my_upline_request(), public.upline_invites(), public.respond_upline(uuid, boolean),
  public.downline_code_changes() from public, anon;
grant execute on function public.admin_set_sponsor_by_code(uuid, text), public.my_household_id(), public.request_upline_by_code(text),
  public.cancel_upline_request(), public.my_upline_request(), public.upline_invites(), public.respond_upline(uuid, boolean),
  public.downline_code_changes() to authenticated;
