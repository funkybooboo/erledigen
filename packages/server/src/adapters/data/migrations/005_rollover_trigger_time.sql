-- Rollover trigger time preference (v0.8.0 automation): when the daily
-- rollover job runs -- 'midnight' (default), '9am', or 'manual'
-- (no daily schedule; catch-up at server startup).

ALTER TABLE user_preferences ADD COLUMN rollover_trigger_time TEXT NOT NULL DEFAULT 'midnight';