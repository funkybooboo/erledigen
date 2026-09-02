-- 003: Generalize day_of_week (single weekday) into days_of_week, a JSON
-- array of weekday numbers (0 = Sunday). This models "every weekday" as
-- [1,2,3,4,5], "every weekend" as [0,6], multi-day schedules like
-- [1,3,5], and keeps single-day schedules as one-element arrays.
-- NULL means "any day" (the old NULL day_of_week).

ALTER TABLE recurring_tasks ADD COLUMN days_of_week TEXT;

UPDATE recurring_tasks
SET days_of_week = CASE
    WHEN day_of_week IS NULL THEN NULL
    ELSE json_array(day_of_week)
END;

ALTER TABLE recurring_tasks DROP COLUMN day_of_week;
