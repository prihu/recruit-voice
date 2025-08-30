-- Create a cron job to process scheduled calls every 5 minutes
-- First enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the cron job
SELECT cron.schedule(
  'process-scheduled-calls',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
        url:='https://yfuroouzxmxlvkwsmtny.supabase.co/functions/v1/process-scheduled-calls',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmdXJvb3V6eG14bHZrd3NtdG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NDA5MTgsImV4cCI6MjA3MjExNjkxOH0.aIjVvQ24fIS1unfm0yP3y2jXuNwe_8X2xGHgl0y5ax8"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);