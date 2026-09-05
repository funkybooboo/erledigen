-- Background job queue table (see ADR-002: SQLite-backed job queue).
-- One table in the application database; jobs survive server restarts and
-- are picked up by the JobRunner poll loop.

CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,              -- 'rollover', 'purge-deleted', 'send-reminder'
    payload TEXT NOT NULL,            -- JSON-encoded job-specific data
    status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'running', 'completed', 'failed', 'dead'
    scheduled_at TEXT NOT NULL,        -- ISO 8601 timestamp; failed retries point at the next attempt
    started_at TEXT,                  -- ISO 8601, set when the job starts
    completed_at TEXT,                -- ISO 8601, set when the job completes
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,                  -- Error message from the last failed attempt
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_jobs_status_scheduled ON jobs(status, scheduled_at);