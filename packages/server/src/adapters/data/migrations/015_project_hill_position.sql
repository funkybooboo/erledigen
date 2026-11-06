-- The hill progress marker (USE-17, ADR-011): one user-dragged position
-- 0-100 on a Basecamp-style hill -- uphill = figuring it out, top =
-- scope settled, downhill = executing. No percentages; nothing moves
-- it but the user.
ALTER TABLE projects ADD COLUMN hill_position INTEGER NOT NULL DEFAULT 0;
