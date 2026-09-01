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
        expect(tables).toContain('_migrations');
    });

    test('is idempotent — re-running applies nothing new', () => {
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
        ]);
    });
});
