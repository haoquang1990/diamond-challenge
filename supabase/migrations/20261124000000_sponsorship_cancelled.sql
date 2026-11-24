-- Story 040 (Huỷ bảo trợ): contact_events accepts the new household-book event
-- `sponsorship_cancelled` ({ personId, note? }; no xp, not an activity).
-- Only the type check is widened; existing rows and every other rule are unchanged.

alter table public.contact_events drop constraint if exists contact_events_type_check;

alter table public.contact_events add constraint contact_events_type_check check (type in (
  'person_added', 'person_updated', 'person_archived', 'person_restored', 'person_stage_changed',
  'activity_logged', 'activity_reassigned', 'person_merged', 'person_not_duplicate', 'person_transferred_out',
  'sponsorship_cancelled'
));
