-- Every minute, ask the app to read new CoachOS mail and send queued replies.
-- Run once per environment in Supabase → SQL Editor, after replacing the two values:
--   YOUR-APP-URL     e.g. https://chat-support-ticket-njxsf.ondigitalocean.app
--   YOUR-CRON-SECRET the same CRON_SECRET the app has in its environment
-- (Needs the pg_cron and pg_net extensions, which migration 20261016000001 enables.)

select cron.unschedule(jobid) from cron.job where jobname = 'coachos-mail-sync';

select cron.schedule(
  'coachos-mail-sync',
  '* * * * *',
  $$
  select net.http_post(
    url := 'YOUR-APP-URL/api/cron/mail',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR-CRON-SECRET', 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
