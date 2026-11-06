-- Households (ADR-0001), household contact book (ADR-0002), code merge (ADR-0003).
-- Rules: design/gdd/accounts.md, design/gdd/crm.md rules 16–25.
-- Converts story 019's per-person sponsor tree into a per-household one; every existing
-- profile (the admin included) gets its own one-person household and keeps its role.

-- ================================================================ config
create table public.app_config (
  key text primary key,
  value jsonb not null
);
insert into public.app_config (key, value) values ('max_household_members', '2');

-- ================================================================ people
alter table public.profiles
  add column display_name text
  constraint profiles_display_name_length check (display_name is null or char_length(btrim(display_name)) between 1 and 60);

-- ================================================================ households
create table public.households (
  id uuid primary key default gen_random_uuid(),
  sponsor_household_id uuid references public.households (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'merged', 'dissolved')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint households_not_own_sponsor check (sponsor_household_id is null or sponsor_household_id <> id)
);
create index households_sponsor_idx on public.households (sponsor_household_id);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default clock_timestamp(),
  left_at timestamptz,
  constraint household_members_left_after_join check (left_at is null or left_at >= joined_at)
);
create unique index household_members_one_active_household on public.household_members (user_id) where left_at is null;
create index household_members_household_idx on public.household_members (household_id);

create table public.household_codes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{4,15}$'),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancel_reason text,
  constraint household_codes_cancel_date check ((status = 'active') = (cancelled_at is null))
);
create unique index household_codes_active_code on public.household_codes (code) where status = 'active';
create unique index household_codes_one_active_per_household on public.household_codes (household_id) where status = 'active';

create table public.household_aggregates (
  household_id uuid primary key references public.households (id) on delete cascade,
  customers integer not null default 0 check (customers >= 0),
  f1 integer not null default 0 check (f1 >= 0),
  contacts integer not null default 0 check (contacts >= 0),
  achieved_30x30 boolean not null default false,
  pending_duplicates integer not null default 0 check (pending_duplicates >= 0),
  needs_recount boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

-- ================================================================ contact book (ADR-0002)
create table public.contact_consents (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  version integer not null check (version > 0),
  consented_at timestamptz not null default now()
);

create table public.contact_events (
  id uuid primary key,
  household_id uuid references public.households (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  type text not null check (type in (
    'person_added', 'person_updated', 'person_archived', 'person_restored', 'person_stage_changed',
    'activity_logged', 'activity_reassigned', 'person_merged', 'person_not_duplicate', 'person_transferred_out'
  )),
  occurred_at timestamptz not null,
  schema_version integer not null default 1 check (schema_version > 0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  -- personal activities stay on the device: an activity must name a person or compensate one
  constraint contact_events_activity_has_person check (
    type <> 'activity_logged' or payload ? 'personId' or payload ? 'compensates'
  )
);
create index contact_events_household_created_idx on public.contact_events (household_id, created_at);
create index contact_events_person_idx on public.contact_events ((payload ->> 'personId'));

-- ================================================================ code merge (ADR-0003)
create table public.code_merges (
  id uuid primary key default gen_random_uuid(),
  keep_household_id uuid not null references public.households (id),
  drop_household_id uuid not null references public.households (id),
  upline_household_id uuid references public.households (id),
  dropped_code_id uuid not null references public.household_codes (id),
  moved_member_ids uuid[] not null default '{}',
  stub_event_ids uuid[] not null default '{}',
  performed_by uuid references public.profiles (id) on delete set null,
  performed_at timestamptz not null default clock_timestamp(),
  undone_by uuid references public.profiles (id) on delete set null,
  undone_at timestamptz
);

create table public.code_merge_moves (
  merge_id uuid not null references public.code_merges (id) on delete cascade,
  event_id uuid not null references public.contact_events (id) on delete cascade,
  person_id text,
  kind text not null check (kind in ('transfer', 'stay')),
  from_household_id uuid not null references public.households (id),
  primary key (merge_id, event_id)
);

create table public.code_merge_sponsors (
  merge_id uuid not null references public.code_merges (id) on delete cascade,
  household_id uuid not null references public.households (id),
  old_sponsor_household_id uuid references public.households (id),
  primary key (merge_id, household_id)
);

create table public.pending_upline (
  id uuid primary key default gen_random_uuid(),
  merge_id uuid not null references public.code_merges (id) on delete cascade,
  kind text not null check (kind in ('contact', 'household')),
  person_id text,
  name text,
  amway_code text,
  household_id uuid references public.households (id),
  status text not null default 'pending' check (status in ('pending', 'assigned', 'cancelled')),
  assigned_household_id uuid references public.households (id),
  assigned_at timestamptz,
  constraint pending_upline_target check ((kind = 'contact') = (person_id is not null))
);

-- ================================================================ move story 019 data
create temporary table _household_map as
  select p.id as profile_id, gen_random_uuid() as household_id, p.sponsor_id, p.created_at
  from public.profiles p;

insert into public.households (id, created_at)
  select household_id, created_at from _household_map;

update public.households h
  set sponsor_household_id = s.household_id
  from _household_map m join _household_map s on s.profile_id = m.sponsor_id
  where h.id = m.household_id;

insert into public.household_members (household_id, user_id, joined_at)
  select household_id, profile_id, created_at from _household_map;

insert into public.household_aggregates (household_id, customers, f1, achieved_30x30, updated_at, updated_by)
  select m.household_id, a.customers, a.f1, a.achieved_30x30, a.updated_at, a.user_id
  from public.aggregates a join _household_map m on m.profile_id = a.user_id;

insert into public.household_aggregates (household_id)
  select household_id from _household_map
  on conflict (household_id) do nothing;

drop table _household_map;

-- retire the per-person tree
drop policy "read self, downline, or all as admin" on public.profiles;
drop table public.aggregates;
drop function public.aggregates_touch_updated_at();
drop trigger profiles_reject_sponsor_cycle on public.profiles;
drop function public.profiles_reject_sponsor_cycle();
drop function public.set_sponsor(uuid, uuid);
drop function public.is_self_or_downline(uuid);
alter table public.profiles drop column sponsor_id;

-- ================================================================ helpers
create function public.max_household_members()
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce((select (value #>> '{}')::integer from public.app_config where key = 'max_household_members'), 2);
$$;

-- The signed-in user's active household, or null.
create function public.current_household()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select household_id from public.household_members
  where user_id = (select auth.uid()) and left_at is null;
$$;

create function public.is_household_member(h uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.household_members
    where household_id = h and user_id = (select auth.uid()) and left_at is null
  );
$$;

-- True when household `target` is the caller's household or below it in the tree.
create function public.is_self_or_downline_household(target uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  with recursive up as (
    select h.id, h.sponsor_household_id, 0 as depth from public.households h where h.id = target
    union all
    select h.id, h.sponsor_household_id, up.depth + 1
    from public.households h join up on h.id = up.sponsor_household_id
    where up.depth < 10000
  )
  select public.current_household() is not null
     and exists (select 1 from up where up.id = public.current_household());
$$;

create function public.can_view_household(h uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin() or public.is_self_or_downline_household(h);
$$;

create function public.has_contact_consent()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.contact_consents where user_id = (select auth.uid()));
$$;

-- Digits only; null when the result is not a valid code.
create function public.normalize_amway_code(raw text)
returns text
language sql immutable set search_path = ''
as $$
  select case when c ~ '^[0-9]{4,15}$' then c end
  from (select regexp_replace(coalesce(raw, ''), '[\s.\-]', '', 'g') as c) s;
$$;

-- ================================================================ triggers
create function public.households_reject_sponsor_cycle()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.sponsor_household_id is null then
    return new;
  end if;
  if exists (
    with recursive up as (
      select h.id, h.sponsor_household_id, 0 as depth from public.households h where h.id = new.sponsor_household_id
      union all
      select h.id, h.sponsor_household_id, up.depth + 1
      from public.households h join up on h.id = up.sponsor_household_id
      where up.depth < 10000
    )
    select 1 from up where up.id = new.id
  ) then
    raise exception 'sponsor cycle: household % cannot be sponsored by %', new.id, new.sponsor_household_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger households_reject_sponsor_cycle
before insert or update of sponsor_household_id on public.households
for each row execute function public.households_reject_sponsor_cycle();

-- At most max_household_members active members, and only in an active household.
create function public.household_members_enforce_limit()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_status text;
  v_count integer;
begin
  if new.left_at is not null then
    return new;
  end if;
  select status into v_status from public.households where id = new.household_id for update;
  if v_status is distinct from 'active' then
    raise exception 'household % is not active', new.household_id using errcode = '23514';
  end if;
  select count(*) into v_count from public.household_members
    where household_id = new.household_id and left_at is null and id <> new.id;
  if v_count >= public.max_household_members() then
    raise exception 'household % already has % members', new.household_id, v_count using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger household_members_enforce_limit
before insert or update of left_at, household_id on public.household_members
for each row execute function public.household_members_enforce_limit();

create function public.household_aggregates_touch()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

create trigger household_aggregates_touch
before insert or update on public.household_aggregates
for each row execute function public.household_aggregates_touch();

-- ================================================================ RPCs: people and consent
create function public.set_display_name(p_name text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  update public.profiles set display_name = nullif(btrim(p_name), '') where id = (select auth.uid());
end;
$$;

create function public.record_contact_consent(p_version integer)
returns void
language sql volatile security definer set search_path = ''
as $$
  insert into public.contact_consents (user_id, version) values ((select auth.uid()), p_version)
  on conflict (user_id) do update set version = excluded.version, consented_at = now();
$$;

-- A member of a two-person household leaves; they get a new one-person household with the
-- same sponsor and no code. Returns the new household id.
create function public.leave_household()
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_old uuid := public.current_household();
  v_sponsor uuid;
  v_new uuid;
begin
  if v_old is null then
    raise exception 'not in a household' using errcode = 'P0002';
  end if;
  if (select count(*) from public.household_members where household_id = v_old and left_at is null) < 2 then
    raise exception 'the only member of a household cannot leave it' using errcode = '23514';
  end if;
  select sponsor_household_id into v_sponsor from public.households where id = v_old;
  update public.household_members set left_at = clock_timestamp()
    where household_id = v_old and user_id = (select auth.uid()) and left_at is null;
  insert into public.households (sponsor_household_id, created_by) values (v_sponsor, (select auth.uid()))
    returning id into v_new;
  insert into public.household_members (household_id, user_id) values (v_new, (select auth.uid()));
  insert into public.household_aggregates (household_id) values (v_new);
  return v_new;
end;
$$;

-- ================================================================ RPCs: admin
create function public.require_admin()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
end;
$$;

create function public.set_household_sponsor(p_household uuid, p_sponsor uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.households set sponsor_household_id = p_sponsor where id = p_household;
  if not found then
    raise exception 'no household %', p_household using errcode = 'P0002';
  end if;
end;
$$;

create function public.set_household_code(p_household uuid, p_code text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_code text := public.normalize_amway_code(p_code);
begin
  perform public.require_admin();
  if v_code is null then
    raise exception 'invalid Amway code' using errcode = '22023';
  end if;
  update public.household_codes set status = 'cancelled', cancelled_at = now(), cancel_reason = 'replaced'
    where household_id = p_household and status = 'active';
  insert into public.household_codes (household_id, code) values (p_household, v_code);
end;
$$;

create function public.cancel_household_code(p_household uuid, p_reason text)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  perform public.require_admin();
  update public.household_codes set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
    where household_id = p_household and status = 'active';
  if not found then
    raise exception 'household % has no active code', p_household using errcode = 'P0002';
  end if;
end;
$$;

-- ================================================================ provisioning (service_role, from Edge Functions)
-- Creates the profile, a new household sponsored by p_sponsor_household (null = root, admin
-- only), its first member and its active code. p_created_by must be a member of the sponsor
-- household (or an admin). Returns the new household id.
create function public.provision_household(
  p_user uuid, p_phone text, p_sponsor_household uuid, p_code text, p_created_by uuid, p_display_name text default null
)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_code text := public.normalize_amway_code(p_code);
  v_creator_admin boolean;
  v_household uuid;
begin
  select role = 'admin' into v_creator_admin from public.profiles where id = p_created_by;
  if p_sponsor_household is null and v_creator_admin is not true then
    raise exception 'only an admin can create a root household' using errcode = '42501';
  end if;
  if p_sponsor_household is not null and v_creator_admin is not true and not exists (
    select 1 from public.household_members
    where household_id = p_sponsor_household and user_id = p_created_by and left_at is null
  ) then
    raise exception 'creator is not a member of the sponsor household' using errcode = '42501';
  end if;
  if v_code is null then
    raise exception 'invalid Amway code' using errcode = '22023';
  end if;
  if exists (select 1 from public.household_codes where code = v_code and status = 'active') then
    raise exception 'Amway code % is already active' , v_code using errcode = '23505';
  end if;
  insert into public.profiles (id, phone, display_name, must_change_password, created_by)
    values (p_user, p_phone, nullif(btrim(p_display_name), ''), true, p_created_by);
  insert into public.households (sponsor_household_id, created_by) values (p_sponsor_household, p_created_by)
    returning id into v_household;
  insert into public.household_members (household_id, user_id) values (v_household, p_user);
  insert into public.household_codes (household_id, code) values (v_household, v_code);
  insert into public.household_aggregates (household_id) values (v_household);
  return v_household;
end;
$$;

-- Adds a new person to an existing household (spouse). p_created_by must be a member of the
-- household, a member of its sponsor household, or an admin.
create function public.provision_member(
  p_user uuid, p_phone text, p_household uuid, p_created_by uuid, p_display_name text default null
)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_sponsor uuid;
begin
  select sponsor_household_id into v_sponsor from public.households where id = p_household;
  if not found then
    raise exception 'no household %', p_household using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.profiles where id = p_created_by and role = 'admin')
     and not exists (
       select 1 from public.household_members
       where user_id = p_created_by and left_at is null and household_id in (p_household, v_sponsor)
     ) then
    raise exception 'creator may not add members to household %', p_household using errcode = '42501';
  end if;
  insert into public.profiles (id, phone, display_name, must_change_password, created_by)
    values (p_user, p_phone, nullif(btrim(p_display_name), ''), true, p_created_by);
  insert into public.household_members (household_id, user_id) values (p_household, p_user);
end;
$$;

-- ================================================================ code merge (ADR-0003)
-- People in a household's contact book with their latest name and Amway code. Contacts already
-- transferred out are left out.
create function public.household_people(h uuid)
returns table (person_id text, name text, amway_code text)
language sql stable security definer set search_path = ''
as $$
  with ev as (
    select e.payload ->> 'personId' as pid, e.payload, e.occurred_at, e.created_at
    from public.contact_events e
    where e.household_id = h and e.type in ('person_added', 'person_updated') and e.payload ? 'personId'
  ),
  names as (
    select distinct on (pid) pid, payload ->> 'name' as name
    from ev where payload ? 'name' order by pid, occurred_at desc, created_at desc
  ),
  codes as (
    select distinct on (pid) pid, public.normalize_amway_code(payload ->> 'amwayCode') as code
    from ev where payload ? 'amwayCode' order by pid, occurred_at desc, created_at desc
  )
  select n.pid, n.name, c.code
  from names n left join codes c on c.pid = n.pid
  where not exists (
    select 1 from public.contact_events t
    where t.household_id = h and t.type = 'person_transferred_out' and t.payload ->> 'personId' = n.pid
  );
$$;

-- Events that belong to one person in a household: those naming the person, merge events
-- naming them, and compensations of either.
create function public.person_event_ids(h uuid, p_person text)
returns table (event_id uuid)
language sql stable security definer set search_path = ''
as $$
  with direct as (
    select e.id from public.contact_events e
    where e.household_id = h and (
      e.payload ->> 'personId' = p_person
      or e.payload ->> 'keepId' = p_person
      or e.payload ->> 'mergedId' = p_person
    )
  )
  select id from direct
  union
  select e.id from public.contact_events e
  where e.household_id = h and e.payload ->> 'compensates' in (select id::text from direct);
$$;

create function public.require_can_merge(p_keep uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() and not public.is_household_member(
    (select sponsor_household_id from public.households where id = p_keep)
  ) then
    raise exception 'only an admin or the sponsor of the kept household can merge codes' using errcode = '42501';
  end if;
end;
$$;

-- What merge_codes would do, without writing anything.
create function public.preview_code_merge(p_keep uuid, p_drop uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_upline uuid;
  v_members integer;
begin
  perform public.require_can_merge(p_keep);
  select sponsor_household_id into v_upline from public.households where id = p_drop;
  select count(*) into v_members from public.household_members
    where household_id in (p_keep, p_drop) and left_at is null;
  return jsonb_build_object(
    'uplineHouseholdId', v_upline,
    'uplineInApp', v_upline is not null,
    'uplineIsKept', v_upline = p_keep,
    'transfer', (select count(*) from public.household_people(p_drop) where amway_code is not null),
    'transferNames', coalesce((select jsonb_agg(name order by name) from public.household_people(p_drop) where amway_code is not null), '[]'::jsonb),
    'stay', (select count(*) from public.household_people(p_drop) where amway_code is null),
    'downlineHouseholds', (select count(*) from public.households where sponsor_household_id = p_drop and status = 'active'),
    'possibleDuplicates', (
      select count(*) from public.household_people(p_drop) d
      join public.household_people(p_keep) k on lower(btrim(d.name)) = lower(btrim(k.name))
      where d.amway_code is null
    ),
    'membersAfter', v_members,
    'membersAllowed', v_members <= public.max_household_members()
  );
end;
$$;

-- Merges household p_drop (code Y) into p_keep (code X). See ADR-0003. Returns the merge id.
create function public.merge_codes(p_keep uuid, p_drop uuid)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_upline uuid;
  v_code_id uuid;
  v_merge uuid;
  v_target uuid;
  v_stub uuid;
  v_stubs uuid[] := '{}';
  v_members uuid[];
  r record;
begin
  perform public.require_can_merge(p_keep);
  if p_keep = p_drop then
    raise exception 'cannot merge a household into itself' using errcode = '22023';
  end if;
  if (select count(*) from public.households where id in (p_keep, p_drop) and status = 'active') <> 2 then
    raise exception 'both households must be active' using errcode = '23514';
  end if;
  if not exists (select 1 from public.household_codes where household_id = p_keep and status = 'active') then
    raise exception 'the kept household has no active code' using errcode = '23514';
  end if;
  select id into v_code_id from public.household_codes where household_id = p_drop and status = 'active';
  if v_code_id is null then
    raise exception 'the merged household has no active code' using errcode = '23514';
  end if;
  if (select count(*) from public.household_members where household_id in (p_keep, p_drop) and left_at is null)
     > public.max_household_members() then
    raise exception 'too many members for one household' using errcode = '23514';
  end if;

  select sponsor_household_id into v_upline from public.households where id = p_drop;
  select array_agg(user_id) into v_members from public.household_members where household_id = p_drop and left_at is null;

  insert into public.code_merges (keep_household_id, drop_household_id, upline_household_id, dropped_code_id,
                                  moved_member_ids, performed_by)
    values (p_keep, p_drop, v_upline, v_code_id, coalesce(v_members, '{}'), (select auth.uid()))
    returning id into v_merge;

  -- 1. contacts with an Amway code go to the upline (or wait for an admin)
  for r in select * from public.household_people(p_drop) where amway_code is not null loop
    v_target := case when v_upline is null then null else v_upline end;
    insert into public.code_merge_moves (merge_id, event_id, person_id, kind, from_household_id)
      select v_merge, event_id, r.person_id, 'transfer', p_drop from public.person_event_ids(p_drop, r.person_id)
      on conflict (merge_id, event_id) do nothing;
    update public.contact_events set household_id = v_target
      where id in (select event_id from public.code_merge_moves where merge_id = v_merge and person_id = r.person_id);
    if v_upline is null then
      insert into public.pending_upline (merge_id, kind, person_id, name, amway_code)
        values (v_merge, 'contact', r.person_id, r.name, r.amway_code);
    end if;
    if v_upline is distinct from p_keep then
      v_stub := gen_random_uuid();
      insert into public.contact_events (id, household_id, author_id, type, occurred_at, payload)
        values (v_stub, p_keep, null, 'person_transferred_out', now(),
                jsonb_build_object('personId', r.person_id, 'name', r.name));
      v_stubs := v_stubs || v_stub;
    end if;
  end loop;

  -- 2. everything else in the merged book joins the kept book
  insert into public.code_merge_moves (merge_id, event_id, person_id, kind, from_household_id)
    select v_merge, e.id, e.payload ->> 'personId', 'stay', p_drop
    from public.contact_events e where e.household_id = p_drop;
  update public.contact_events set household_id = p_keep where household_id = p_drop;

  -- 3. members move, the merged household and its code retire
  update public.household_members set left_at = clock_timestamp() where household_id = p_drop and left_at is null;
  update public.households set status = 'merged' where id = p_drop;
  insert into public.household_members (household_id, user_id) select p_keep, unnest(coalesce(v_members, '{}'));
  update public.household_codes
    set status = 'cancelled', cancelled_at = now(),
        cancel_reason = 'merged into ' || (select code from public.household_codes where household_id = p_keep and status = 'active')
    where id = v_code_id;

  -- 4. the merged household's F1 households move up to its sponsor
  insert into public.code_merge_sponsors (merge_id, household_id, old_sponsor_household_id)
    select v_merge, id, sponsor_household_id from public.households where sponsor_household_id = p_drop;
  update public.households set sponsor_household_id = v_upline where sponsor_household_id = p_drop;
  if v_upline is null then
    insert into public.pending_upline (merge_id, kind, household_id)
      select v_merge, 'household', household_id from public.code_merge_sponsors where merge_id = v_merge;
  end if;

  -- 5. numbers are recounted by the members' apps
  insert into public.household_aggregates (household_id, needs_recount)
    select h, true from unnest(array[p_keep, v_upline]) as h where h is not null
    on conflict (household_id) do update set needs_recount = true;

  update public.code_merges set stub_event_ids = v_stubs where id = v_merge;
  return v_merge;
end;
$$;

-- Admin only: reverses one merge. Refused when the dropped code is active elsewhere, when a moved
-- member is no longer in the kept household, or when the merge was already undone.
create function public.undo_code_merge(p_merge uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  m public.code_merges%rowtype;
  v_code text;
begin
  perform public.require_admin();
  select * into m from public.code_merges where id = p_merge for update;
  if not found then
    raise exception 'no merge %', p_merge using errcode = 'P0002';
  end if;
  if m.undone_at is not null then
    raise exception 'merge % was already undone', p_merge using errcode = '23514';
  end if;
  select code into v_code from public.household_codes where id = m.dropped_code_id;
  if exists (select 1 from public.household_codes where code = v_code and status = 'active') then
    raise exception 'Amway code % is active in another household', v_code using errcode = '23505';
  end if;
  if exists (
    select 1 from unnest(m.moved_member_ids) u
    where not exists (
      select 1 from public.household_members
      where user_id = u and household_id = m.keep_household_id and left_at is null
    )
  ) then
    raise exception 'a moved member is no longer in the kept household' using errcode = '23514';
  end if;

  delete from public.contact_events where id = any (m.stub_event_ids);
  -- moved events, plus events written later for the same people where they now live
  update public.contact_events set household_id = m.drop_household_id
    where id in (select event_id from public.code_merge_moves where merge_id = p_merge);
  update public.contact_events e set household_id = m.drop_household_id
    where e.created_at > m.performed_at
      and (e.household_id is null or e.household_id in (m.keep_household_id, m.upline_household_id))
      and (
        e.payload ->> 'personId' in (select person_id from public.code_merge_moves where merge_id = p_merge and person_id is not null)
        or e.payload ->> 'compensates' in (select event_id::text from public.code_merge_moves where merge_id = p_merge)
      );

  update public.households set status = 'active' where id = m.drop_household_id;
  update public.household_members set left_at = clock_timestamp()
    where household_id = m.keep_household_id and user_id = any (m.moved_member_ids) and left_at is null;
  insert into public.household_members (household_id, user_id) select m.drop_household_id, unnest(m.moved_member_ids);
  update public.households h set sponsor_household_id = s.old_sponsor_household_id
    from public.code_merge_sponsors s where s.merge_id = p_merge and h.id = s.household_id;
  update public.household_codes set status = 'active', cancelled_at = null, cancel_reason = null where id = m.dropped_code_id;
  update public.pending_upline set status = 'cancelled' where merge_id = p_merge and status = 'pending';
  insert into public.household_aggregates (household_id, needs_recount)
    select h, true from unnest(array[m.keep_household_id, m.drop_household_id, m.upline_household_id]) as h where h is not null
    on conflict (household_id) do update set needs_recount = true;
  update public.code_merges set undone_at = clock_timestamp(), undone_by = (select auth.uid()) where id = p_merge;
end;
$$;

-- Admin only: gives a waiting contact or household its upline.
create function public.assign_pending_upline(p_pending uuid, p_household uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  p public.pending_upline%rowtype;
begin
  perform public.require_admin();
  select * into p from public.pending_upline where id = p_pending and status = 'pending' for update;
  if not found then
    raise exception 'no pending item %', p_pending using errcode = 'P0002';
  end if;
  if p.kind = 'contact' then
    update public.contact_events set household_id = p_household
      where household_id is null
        and id in (select event_id from public.code_merge_moves where merge_id = p.merge_id and person_id = p.person_id);
  else
    update public.households set sponsor_household_id = p_household where id = p.household_id;
  end if;
  update public.pending_upline set status = 'assigned', assigned_household_id = p_household, assigned_at = now()
    where id = p_pending;
end;
$$;

-- ================================================================ privileges
revoke all on table
  public.app_config, public.households, public.household_members, public.household_codes,
  public.household_aggregates, public.contact_consents, public.contact_events,
  public.code_merges, public.code_merge_moves, public.code_merge_sponsors, public.pending_upline
from anon, authenticated;
grant select on table public.app_config, public.households, public.household_members, public.household_codes,
  public.code_merges, public.pending_upline to authenticated;
grant select, insert, update on table public.household_aggregates to authenticated;
grant select, insert on table public.contact_events to authenticated;
grant select on table public.contact_consents to authenticated;

revoke execute on function
  public.max_household_members(), public.current_household(), public.is_household_member(uuid),
  public.is_self_or_downline_household(uuid), public.can_view_household(uuid), public.has_contact_consent(),
  public.normalize_amway_code(text), public.households_reject_sponsor_cycle(),
  public.household_members_enforce_limit(), public.household_aggregates_touch(),
  public.set_display_name(text), public.record_contact_consent(integer), public.leave_household(),
  public.require_admin(), public.set_household_sponsor(uuid, uuid), public.set_household_code(uuid, text),
  public.cancel_household_code(uuid, text),
  public.provision_household(uuid, text, uuid, text, uuid, text), public.provision_member(uuid, text, uuid, uuid, text),
  public.household_people(uuid), public.person_event_ids(uuid, text), public.require_can_merge(uuid),
  public.preview_code_merge(uuid, uuid), public.merge_codes(uuid, uuid), public.undo_code_merge(uuid),
  public.assign_pending_upline(uuid, uuid)
from public, anon;
grant execute on function
  public.current_household(), public.is_household_member(uuid), public.is_self_or_downline_household(uuid),
  public.can_view_household(uuid), public.has_contact_consent(), public.normalize_amway_code(text),
  public.set_display_name(text), public.record_contact_consent(integer), public.leave_household(),
  public.set_household_sponsor(uuid, uuid), public.set_household_code(uuid, text),
  public.cancel_household_code(uuid, text), public.preview_code_merge(uuid, uuid), public.merge_codes(uuid, uuid),
  public.undo_code_merge(uuid), public.assign_pending_upline(uuid, uuid)
to authenticated;
grant execute on function
  public.provision_household(uuid, text, uuid, text, uuid, text), public.provision_member(uuid, text, uuid, uuid, text)
to service_role;

-- ================================================================ row level security
alter table public.app_config enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_codes enable row level security;
alter table public.household_aggregates enable row level security;
alter table public.contact_consents enable row level security;
alter table public.contact_events enable row level security;
alter table public.code_merges enable row level security;
alter table public.code_merge_moves enable row level security;
alter table public.code_merge_sponsors enable row level security;
alter table public.pending_upline enable row level security;

create policy "anyone signed in reads config" on public.app_config for select to authenticated using (true);

-- people: self, admin, and members of households the caller may view (own household and downline)
create policy "read self, viewable households, or all as admin"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or public.is_admin()
  or exists (
    select 1 from public.household_members m
    where m.user_id = profiles.id and m.left_at is null and public.can_view_household(m.household_id)
  )
);

create policy "read own household and downline" on public.households for select to authenticated
using (public.can_view_household(id));
create policy "read own household and downline" on public.household_members for select to authenticated
using (public.can_view_household(household_id));
create policy "read own household and downline" on public.household_codes for select to authenticated
using (public.can_view_household(household_id));
create policy "read own household and downline" on public.household_aggregates for select to authenticated
using (public.can_view_household(household_id));
create policy "members insert own household numbers" on public.household_aggregates for insert to authenticated
with check (public.is_household_member(household_id));
create policy "members update own household numbers" on public.household_aggregates for update to authenticated
using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

create policy "read own consent" on public.contact_consents for select to authenticated
using (user_id = (select auth.uid()));

-- the contact book: members only, never upline, downline or admin through the API
create policy "members read their household book" on public.contact_events for select to authenticated
using (public.is_household_member(household_id));
create policy "members append to their household book" on public.contact_events for insert to authenticated
with check (
  public.is_household_member(household_id)
  and author_id = (select auth.uid())
  and type <> 'person_transferred_out'
  and public.has_contact_consent()
);

create policy "admin reads merges" on public.code_merges for select to authenticated using (public.is_admin());
create policy "admin reads pending upline" on public.pending_upline for select to authenticated using (public.is_admin());
