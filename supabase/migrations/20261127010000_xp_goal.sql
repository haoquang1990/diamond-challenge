-- Story 056: each person picks the daily XP goal (20-200 in the app, step 5); a change counts
-- from the next local day. `xpGoal` settings ({ xp, from }) follow the account through the
-- personal progress stream.
alter table public.personal_events drop constraint personal_events_settings_progress_only;
alter table public.personal_events add constraint personal_events_settings_progress_only
  check (type <> 'settings_changed'
         or payload ?| array['achievementAcknowledged', 'stageAcknowledged', 'achievementsSeeded', 'badgesSeeded', 'contactSort', 'xpGoal']);
