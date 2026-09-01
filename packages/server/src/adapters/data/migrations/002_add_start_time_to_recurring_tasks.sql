-- 002_add_start_time_to_recurring_tasks.sql
-- Adds the default start time stamped onto generated task instances
-- (RecurringTask.startTime, "HH:MM" or NULL).

ALTER TABLE recurring_tasks ADD COLUMN start_time TEXT;
