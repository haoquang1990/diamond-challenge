-- Story 068: every account's household has an Amway code. A member of a household that has no
-- active code sets it once with claim_household_code. A code another household already holds is
-- not taken over: it becomes a pending claim the admin settles (set_household_code stays admin-only,
-- as does changing a code that is set).

create table public.code_claims (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  claimed_by uuid references auth.users (id) on delete set null,
  code text not null check (code ~ '^[0-9]{4,15}$'),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index code_claims_one_pending on public.code_claims (household_id) where status = 'pending';

alter table public.code_claims enable row level security;
revoke all on table public.code_claims from anon, authenticated;
grant select on table public.code_claims to authenticated;
create policy "own household or admin reads claims" on public.code_claims for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.household_members m
      where m.household_id = code_claims.household_id and m.user_id = (select auth.uid()) and m.left_at is null
    )
  );

-- Returns 'saved' | 'taken' (a claim for the admin) | 'already_set' | 'invalid' | 'no_household'.
create function public.claim_household_code(p_code text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_code text := public.normalize_amway_code(p_code);
  v_household uuid;
begin
  select m.household_id into v_household
    from public.household_members m join public.households h on h.id = m.household_id
    where m.user_id = (select auth.uid()) and m.left_at is null and h.status = 'active';
  if v_household is null then
    return 'no_household';
  end if;
  if v_code is null then
    return 'invalid';
  end if;
  if exists (select 1 from public.household_codes where household_id = v_household and status = 'active') then
    return 'already_set';
  end if;
  begin
    insert into public.household_codes (household_id, code) values (v_household, v_code);
  exception when unique_violation then
    -- Held by another household (also when it was taken a moment ago): the admin decides.
    delete from public.code_claims where household_id = v_household and status = 'pending';
    insert into public.code_claims (household_id, claimed_by, code) values (v_household, (select auth.uid()), v_code);
    return 'taken';
  end;
  update public.code_claims set status = 'resolved', resolved_at = now()
    where household_id = v_household and status = 'pending';
  return 'saved';
end;
$$;

revoke all on function public.claim_household_code(text) from public, anon;
grant execute on function public.claim_household_code(text) to authenticated;
