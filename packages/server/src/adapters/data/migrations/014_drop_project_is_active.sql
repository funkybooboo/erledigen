-- The v0.9.0 active/inactive distinction dies with the Kanban reversal
-- (USE-18, ADR-011): a scheduled task has no lifecycle beyond done, so
-- projects have no active state either. The column drops; nothing
-- reads it anymore.
ALTER TABLE projects DROP COLUMN is_active;
