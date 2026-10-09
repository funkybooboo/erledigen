import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
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
        expect(tables).toContain('some_day_groups');
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
        ]);
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
});
