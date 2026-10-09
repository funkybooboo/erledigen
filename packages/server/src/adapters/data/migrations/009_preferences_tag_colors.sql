-- Tag color overrides (v0.11.0 theming): JSON map of tag name ->
-- palette id (TagColorId in shared constants; 'coral', 'amber', 'lime',
-- 'sage', 'sky', 'violet', 'rose', 'slate'). Auto-assignments and user
-- recolors both persist here (USE-4).

ALTER TABLE user_preferences ADD COLUMN tag_colors TEXT NOT NULL DEFAULT '{}';