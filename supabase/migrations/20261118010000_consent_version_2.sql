-- Story 033: the consent text now also says personal progress is stored on the server, so
-- everyone who agreed at version 1 is asked once more. has_current_contact_consent() reads
-- this value, so personal_events inserts stay refused until the account agrees to version 2.
-- `contactConsentVersion` in src/config/game-config.json MUST be raised to the same value
-- in the same release.
insert into public.app_config (key, value) values ('contact_consent_version', '2')
on conflict (key) do update set value = excluded.value;
