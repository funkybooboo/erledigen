-- Appearance preferences (v0.11.0 customization): font size of the
-- day-list reading surfaces ('small' | 'medium' | 'large'; 'medium'
-- default), task-row density ('compact' | 'comfortable'; 'comfortable'
-- default), and the completion pulse ('flash' | 'none'; 'flash'
-- default). The client maps these onto --fs-*/--row-* CSS tokens via
-- [data-font-size]/[data-row-density] on the document root.

ALTER TABLE user_preferences ADD COLUMN font_size TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE user_preferences ADD COLUMN row_density TEXT NOT NULL DEFAULT 'comfortable';
ALTER TABLE user_preferences ADD COLUMN completion_animation TEXT NOT NULL DEFAULT 'flash';