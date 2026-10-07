-- Accent scheme preference (v0.11.0 theming): which accent palette the
-- client renders -- 'blue' (default), 'coral', or 'amber', drawn from
-- the logo's pill colors (ACCENT_SCHEMES in shared constants).

ALTER TABLE user_preferences ADD COLUMN accent TEXT NOT NULL DEFAULT 'blue';