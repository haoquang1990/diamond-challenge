-- Story 070: cheering earns XP. The app records it as a personal `cheer_sent` event
-- ({ xp, toUserId?, toHouseholdId }) that syncs with my progress; it is not a "Việc làm".
alter table public.personal_events drop constraint personal_events_type_check;
alter table public.personal_events add constraint personal_events_type_check
  check (type in ('lesson_completed', 'activity_logged', 'settings_changed', 'cheer_sent'));
