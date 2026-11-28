-- Story 065 (Sửa ghi chú): contact_events accepts the new household-book event
-- `activity_note_changed` ({ personId, activityId, note }; no xp, not an activity, so the
-- households_stamp_activity trigger ignores it). Only the type check is widened.

alter table public.contact_events drop constraint if exists contact_events_type_check;

alter table public.contact_events add constraint contact_events_type_check check (type in (
  'person_added', 'person_updated', 'person_archived', 'person_restored', 'person_stage_changed',
  'activity_logged', 'activity_reassigned', 'person_merged', 'person_not_duplicate', 'person_transferred_out',
  'sponsorship_cancelled', 'activity_note_changed'
));
