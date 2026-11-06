-- Someday tabs + lists replace someday groups (USE-16, ADR-011/ADR-026).
-- Each existing group becomes a list under the default tab (ids
-- preserved, so tasks keep their parking spot); the group tag and
-- description die with the v1 model (plain lists carry no tag -- a
-- project tab carries the project's tag instead).

CREATE TABLE someday_tabs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    project_tag TEXT,                    -- the project's tag; NULL = plain tab
    created_at TEXT NOT NULL
);

CREATE TABLE someday_lists (
    id TEXT PRIMARY KEY,
    tab_id TEXT NOT NULL,                -- FK to someday_tabs(id)
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

-- The default tab every install owns (fixed id 'default', undeletable
-- -- dateless unlisted tasks render in it) and the default list under
-- it. Both named "Someday": the story's default tab + list.
INSERT INTO someday_tabs (id, name, position, project_tag, created_at)
    VALUES ('default', 'Someday', 0, NULL, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));
INSERT INTO someday_lists (id, tab_id, name, position, created_at)
    VALUES ('default-list', 'default', 'Someday', 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));

-- Groups become lists under the default tab, ids preserved.
INSERT INTO someday_lists (id, tab_id, name, position, created_at)
    SELECT id, 'default', name, position, created_at FROM some_day_groups;

DROP INDEX idx_tasks_some_day_group_id;
ALTER TABLE tasks RENAME COLUMN some_day_group_id TO someday_list_id;
CREATE INDEX idx_tasks_someday_list_id ON tasks(someday_list_id);

DROP TABLE some_day_groups;
