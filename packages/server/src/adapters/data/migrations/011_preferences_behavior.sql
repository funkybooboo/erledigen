-- Behavior preferences (v0.11.0 customization): whether the active
-- filter set persists across sessions (0 = every session starts with
-- no filters, cleared on load; 1 = keep the last session's filters,
-- the shipped default).

ALTER TABLE user_preferences ADD COLUMN persist_active_filters INTEGER NOT NULL DEFAULT 1;