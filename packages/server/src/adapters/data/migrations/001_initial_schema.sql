-- 001_initial_schema.sql
-- Initial schema for Erledigen: tasks, projects, someday groups,
-- recurring tasks + stats, and user preferences.
-- Type mapping per ADR-001: booleans as 0/1 INTEGER, JSON arrays/objects as
-- TEXT, ISO 8601 strings as TEXT.

CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    notes TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    date TEXT,                          -- ISO date string, NULL means Someday
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',    -- JSON array of strings
    parent_id TEXT,                     -- FK to tasks(id) for sub-tasks
    rollover_enabled INTEGER NOT NULL DEFAULT 0,
    some_day_group_id TEXT,             -- FK to some_day_groups(id)
    position INTEGER,
    state TEXT,                         -- 'ready', 'scheduled', 'done', NULL
    recurring_task_id TEXT,             -- FK to recurring_tasks(id)
    instance_date TEXT,
    original_scheduled_date TEXT,
    days_late INTEGER NOT NULL DEFAULT 0,
    depends_on TEXT,
    start_time TEXT,                    -- 'HH:MM' time string
    end_time TEXT,                      -- 'HH:MM' time string
    reminder TEXT,                      -- JSON: { time, channels }
    deleted_at TEXT                     -- ISO timestamp, NULL = not deleted
);

CREATE INDEX idx_tasks_date ON tasks(date);
CREATE INDEX idx_tasks_some_day_group_id ON tasks(some_day_group_id);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX idx_tasks_recurring_task_id ON tasks(recurring_task_id);
CREATE INDEX idx_tasks_deleted_at ON tasks(deleted_at);

CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tag TEXT NOT NULL UNIQUE,
    description TEXT,
    start_date TEXT,
    due_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    completed_at TEXT
);

CREATE TABLE some_day_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    tag TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE recurring_tasks (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    notes TEXT,
    tags TEXT NOT NULL DEFAULT '[]',    -- JSON array of strings
    frequency TEXT NOT NULL,            -- 'daily', 'weekly', 'monthly', 'yearly'
    interval INTEGER NOT NULL DEFAULT 1,
    day_of_week INTEGER,
    day_of_month INTEGER,
    start_date TEXT NOT NULL,
    end_date TEXT,
    rollover_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE recurring_task_stats (
    recurring_task_id TEXT PRIMARY KEY,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    total_completions INTEGER NOT NULL DEFAULT 0,
    last_completed_date TEXT
);

CREATE TABLE user_preferences (
    id TEXT PRIMARY KEY DEFAULT 'default',
    theme TEXT NOT NULL DEFAULT 'system',
    locale TEXT NOT NULL DEFAULT 'en',
    some_day_panel_width INTEGER NOT NULL DEFAULT 280,
    some_day_panel_collapsed INTEGER NOT NULL DEFAULT 0,
    some_day_panel_last_open_width INTEGER NOT NULL DEFAULT 280,
    rollover_enabled INTEGER NOT NULL DEFAULT 1,
    show_empty_days INTEGER NOT NULL DEFAULT 1,
    delete_confirmation TEXT NOT NULL DEFAULT 'instant',
    active_filters TEXT NOT NULL DEFAULT '{}',   -- JSON: { tags, showCompleted }
    tag_kinds TEXT NOT NULL DEFAULT '[]',        -- JSON: TagKind[]
    tag_kind_map TEXT NOT NULL DEFAULT '{}',     -- JSON: Record<string, string>
    time_format TEXT NOT NULL DEFAULT '12h',
    timezone TEXT,                                -- IANA zone or NULL
    updated_at TEXT NOT NULL
);
