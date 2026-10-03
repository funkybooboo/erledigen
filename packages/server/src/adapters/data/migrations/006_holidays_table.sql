-- 006_holidays_table.sql
-- Named calendar dates (v0.9.0): banners above day-section headers,
-- Settings management, .ics import. One row per named date.

CREATE TABLE holidays (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    date TEXT NOT NULL,                  -- local yyyy-MM-dd key string
    created_at TEXT NOT NULL
);

CREATE INDEX idx_holidays_date ON holidays(date);