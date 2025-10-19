-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the poll-stuck-screens function to run every 5 minutes
SELECT cron.schedule(
  'poll-stuck-screens-job',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://yfuroouzxmxlvkwsmtny.supabase.co/functions/v1/poll-stuck-screens',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object('time', now())
  ) AS request_id;
  $$
);