-- Fix 2026-11-26 and story 052: personal settings the app syncs.
--
-- * `badgesSeeded` (story 047): the app writes `{ badgesSeeded: true, silent: true }` on its own
--   and pushes it with the progress stream. The check below did not list it, so the insert was
--   refused and every later push and the pull of that account stopped.
-- * `contactSort` (story 052): the chosen order of the Làm list follows the account.
alter table public.personal_events drop constraint personal_events_settings_progress_only;
alter table public.personal_events add constraint personal_events_settings_progress_only
  check (type <> 'settings_changed'
         or payload ?| array['achievementAcknowledged', 'stageAcknowledged', 'achievementsSeeded', 'badgesSeeded', 'contactSort']);
