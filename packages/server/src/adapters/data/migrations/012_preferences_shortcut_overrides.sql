-- Shortcut remapping (v0.11.0 customization): JSON map of shortcut id
-- -> binding strings (the client's keybindings registry owns the ids and
-- the grammar; the server persists and replays the shape verbatim).

ALTER TABLE user_preferences ADD COLUMN shortcut_overrides TEXT NOT NULL DEFAULT '{}';