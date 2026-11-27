-- Story 058: every 15 minutes, ask the send-reminders Edge Function to push the reminders that are
-- due. The function decides who (time reached, not reminded today, goal not met) and is safe to
-- call any time, so the call carries no secret. Skipped where pg_cron / pg_net are not available
-- (the local test database).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net with schema extensions;
    perform cron.unschedule(jobid) from cron.job where jobname = 'send-reminders';
    perform cron.schedule(
      'send-reminders',
      '*/15 * * * *',
      $job$ select net.http_post(
        url := 'https://ixxtoriatszyeapnyiwh.supabase.co/functions/v1/send-reminders',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
      ) $job$
    );
  end if;
end;
$$;
