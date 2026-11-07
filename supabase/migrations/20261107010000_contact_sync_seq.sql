-- Amends ADR-0002 (from the 2026-11-07 architecture review): the contact book is pulled by a server-assigned `sync_seq`
-- instead of `created_at`. A row keeps its created_at when a code merge (or its undo, or an
-- admin assignment) moves it to another household, so a device whose cursor was already past
-- that timestamp would never see the moved row. `sync_seq` is bumped on insert and whenever
-- `household_id` changes, so a move always lands after every cursor.

create sequence public.contact_events_sync_seq as bigint;

alter table public.contact_events add column sync_seq bigint;

-- existing rows: number them in the order the old cursor saw them
with ordered as (
  select id, row_number() over (order by created_at, id) as rn from public.contact_events
)
update public.contact_events e set sync_seq = o.rn from ordered o where e.id = o.id;

-- the next value is max + 1 (1 when the table is empty)
select setval('public.contact_events_sync_seq', coalesce((select max(sync_seq) from public.contact_events), 0) + 1, false);

alter table public.contact_events alter column sync_seq set not null;

create unique index contact_events_sync_seq_key on public.contact_events (sync_seq);
create index contact_events_household_seq_idx on public.contact_events (household_id, sync_seq);
drop index public.contact_events_household_created_idx;

-- Runs as the owner so a member's insert may use the sequence. A value sent by a client is
-- ignored; an update that leaves household_id as it was does not bump.
create function public.contact_events_assign_sync_seq()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.household_id is distinct from old.household_id then
    new.sync_seq := nextval('public.contact_events_sync_seq');
  else
    new.sync_seq := old.sync_seq;
  end if;
  return new;
end;
$$;

create trigger contact_events_assign_sync_seq
before insert or update of household_id on public.contact_events
for each row execute function public.contact_events_assign_sync_seq();

revoke all on sequence public.contact_events_sync_seq from public, anon, authenticated;
revoke execute on function public.contact_events_assign_sync_seq() from public, anon, authenticated;

-- ADR-0003 (merging two codes) is deferred to phase 2b. Lock its functions until then; they
-- stay in place and are covered by tests, and already bump sync_seq through the trigger above.
revoke execute on function
  public.preview_code_merge(uuid, uuid), public.merge_codes(uuid, uuid),
  public.undo_code_merge(uuid), public.assign_pending_upline(uuid, uuid)
from authenticated;
