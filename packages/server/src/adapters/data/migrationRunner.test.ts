import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runMigrations } from './migrationRunner';

describe('runMigrations', () => {
    test('applies pending migrations and creates the schema', () => {
        const db = new Database(':memory:');
        runMigrations(db);

        const tables = (
            db
                .query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
                .all() as Array<{ name: string }>
        ).map(row => row.name);

        expect(tables).toContain('tasks');
        expect(tables).toContain('projects');
        expect(tables).toContain('someday_tabs');
        expect(tables).toContain('someday_lists');
        // The v0.9.0 active/inactive distinction is gone (USE-18).
        const projectCols = db.query("PRAGMA table_info('projects')").all() as Array<{
            name: string;
        }>;
        expect(projectCols.map(col => col.name)).not.toContain('is_active');
        expect(tables).toContain('recurring_tasks');
        expect(tables).toContain('recurring_task_stats');
        expect(tables).toContain('user_preferences');
        expect(tables).toContain('holidays');
        expect(tables).toContain('_migrations');
    });

    test('is idempotent -- re-running applies nothing new', () => {
        const db = new Database(':memory:');
        runMigrations(db);

        const appliedCount = () =>
            (db.query('SELECT COUNT(*) AS n FROM _migrations').get() as { n: number }).n;

        const afterFirst = appliedCount();
        expect(afterFirst).toBeGreaterThan(0);

        runMigrations(db);
        expect(appliedCount()).toBe(afterFirst);
    });

    test('applies migrations in sequence and records them by filename', () => {
        const db = new Database(':memory:');
        runMigrations(db);

        const applied = db.query('SELECT name FROM _migrations ORDER BY id').all() as Array<{
            name: string;
        }>;
        expect(applied.map(row => row.name)).toEqual([
            '001_initial_schema.sql',
            '002_add_start_time_to_recurring_tasks.sql',
            '003_recurring_days_of_week.sql',
            '004_jobs_table.sql',
            '005_rollover_trigger_time.sql',
            '006_holidays_table.sql',
            '007_day_notes.sql',
            '008_preferences_accent.sql',
            '009_preferences_tag_colors.sql',
            '010_preferences_appearance.sql',
            '011_preferences_behavior.sql',
            '012_preferences_shortcut_overrides.sql',
            '013_someday_tabs_lists.sql',
            '014_drop_project_is_active.sql',
            '015_project_hill_position.sql',
        ]);
    });

    test('fresh databases carry the shortcut overrides column empty', () => {
        const db = new Database(':memory:');
        runMigrations(db);
        const cols = db.query("PRAGMA table_info('user_preferences')").all() as Array<{
            name: string;
            dflt_value: string | null;
        }>;
        expect(cols.find(col => col.name === 'shortcut_overrides')?.dflt_value).toBe("'{}'");
    });

    test('fresh databases carry the behavior column with the keep-filters default', () => {
        const db = new Database(':memory:');
        runMigrations(db);
        const cols = db.query("PRAGMA table_info('user_preferences')").all() as Array<{
            name: string;
            dflt_value: string | null;
        }>;
        expect(cols.find(col => col.name === 'persist_active_filters')?.dflt_value).toBe('1');
    });

    test('fresh databases carry the appearance columns with their defaults', () => {
        const db = new Database(':memory:');
        runMigrations(db);
        const cols = db.query("PRAGMA table_info('user_preferences')").all() as Array<{
            name: string;
            dflt_value: string | null;
        }>;
        expect(cols.find(col => col.name === 'font_size')?.dflt_value).toBe("'medium'");
        expect(cols.find(col => col.name === 'row_density')?.dflt_value).toBe("'comfortable'");
        expect(cols.find(col => col.name === 'completion_animation')?.dflt_value).toBe("'flash'");
    });

    test('fresh databases carry the tag colors column with the empty default', () => {
        const db = new Database(':memory:');
        runMigrations(db);
        const cols = db.query("PRAGMA table_info('user_preferences')").all() as Array<{
            name: string;
            dflt_value: string | null;
        }>;
        const tagColors = cols.find(col => col.name === 'tag_colors');
        expect(tagColors?.dflt_value).toBe("'{}'");
    });

    test('fresh databases carry the accent column with the blue default', () => {
        const db = new Database(':memory:');
        runMigrations(db);
        const cols = db.query("PRAGMA table_info('user_preferences')").all() as Array<{
            name: string;
            dflt_value: string | null;
        }>;
        const accent = cols.find(col => col.name === 'accent');
        expect(accent?.dflt_value).toBe("'blue'");
    });

    test('013 migrates an existing install: groups become lists, the task column renames', () => {
        // Simulate a v0.15 install: apply everything before 013, then
        // seed old-shape data (a group with a parked task, plus an
        // unlisted parked task) and run the pending migration.
        const db = new Database(':memory:');
        db.run(`
            CREATE TABLE _migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
            )
        `);
        const dir = join(import.meta.dir, 'migrations');
        for (const name of readdirSync(dir)
            .filter(f => f.endsWith('.sql') && f < '013_someday_tabs_lists.sql')
            .sort()) {
            db.exec(readFileSync(join(dir, name), 'utf8'));
            db.run('INSERT INTO _migrations (name) VALUES (?)', [name]);
        }
        db.run(
            "INSERT INTO some_day_groups (id, name, description, tag, position, created_at) VALUES ('g1', 'Work', NULL, '#work', 3, '2026-01-01T00:00:00.000Z')",
        );
        db.run(
            "INSERT INTO tasks (id, text, completed, date, created_at, updated_at, tags, some_day_group_id) VALUES ('t1', 'parked idea', 0, NULL, '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z', '[]', 'g1')",
        );
        db.run(
            "INSERT INTO tasks (id, text, completed, date, created_at, updated_at, tags, some_day_group_id) VALUES ('t2', 'unlisted idea', 0, NULL, '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z', '[]', NULL)",
        );

        runMigrations(db);

        // The groups table is gone; tabs + lists exist.
        const tables = (
            db
                .query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
                .all() as Array<{ name: string }>
        ).map(row => row.name);
        expect(tables).not.toContain('some_day_groups');
        expect(tables).toContain('someday_tabs');
        expect(tables).toContain('someday_lists');
        // The v0.9.0 active/inactive distinction is gone (USE-18).
        const projectCols = db.query("PRAGMA table_info('projects')").all() as Array<{
            name: string;
        }>;
        expect(projectCols.map(col => col.name)).not.toContain('is_active');

        // The default tab is seeded; the old group became a list under
        // it, id and position preserved (the tag dies with the v1 model).
        const tabs = db
            .query('SELECT id, name, position FROM someday_tabs ORDER BY position')
            .all() as Array<{ id: string; name: string; position: number }>;
        expect(tabs).toEqual([{ id: 'default', name: 'Someday', position: 0 }]);
        const lists = db
            .query(
                'SELECT id, tab_id, name, position FROM someday_lists ORDER BY position, created_at',
            )
            .all() as Array<{ id: string; tab_id: string; name: string; position: number }>;
        expect(lists).toEqual([
            { id: 'default-list', tab_id: 'default', name: 'Someday', position: 0 },
            { id: 'g1', tab_id: 'default', name: 'Work', position: 3 },
        ]);

        // The task column renamed; ids keep pointing at their list.
        const taskCols = db.query("PRAGMA table_info('tasks')").all() as Array<{
            name: string;
        }>;
        expect(taskCols.map(col => col.name)).not.toContain('some_day_group_id');
        expect(taskCols.map(col => col.name)).toContain('someday_list_id');
        const parked = db.query('SELECT someday_list_id FROM tasks WHERE id = ?').get('t1') as {
            someday_list_id: string | null;
        };
        expect(parked.someday_list_id).toBe('g1');
        const unlisted = db.query('SELECT someday_list_id FROM tasks WHERE id = ?').get('t2') as {
            someday_list_id: string | null;
        };
        expect(unlisted.someday_list_id).toBeNull();
    });
});
