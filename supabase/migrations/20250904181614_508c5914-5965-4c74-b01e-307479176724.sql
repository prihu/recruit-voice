-- Clean up all existing data for fresh testing
DELETE FROM screening_events;
DELETE FROM call_logs;
DELETE FROM scheduled_calls;
DELETE FROM screens;
DELETE FROM candidates;
DELETE FROM agent_archive_log;
DELETE FROM analytics_events;
DELETE FROM bulk_operations;
DELETE FROM roles;