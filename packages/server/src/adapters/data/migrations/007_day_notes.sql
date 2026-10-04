-- 007_day_notes.sql
-- Day notes, the paper calendar's margin (v0.10.0): one live-markdown
-- field per day, part of the day in the export backup. One row per date.

CREATE TABLE day_notes (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,               -- local yyyy-MM-dd key string
    notes TEXT NOT NULL,                     -- markdown (rendered client-side)
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);