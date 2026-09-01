/**
 * Raw SQL migration runner (see ADR-003)
 *
 * Applies sequentially-numbered .sql files from the migrations/ directory.
 * Forward-only: each migration runs once, in a transaction, and is recorded
 * in the `_migrations` tracking table. A failed migration rolls back and
 * throws, aborting server startup — no partial schema states.
 */

import type { Database } from 'bun:sqlite';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Resolve the migrations directory.
 *
 * Source layout: this file sits in src/adapters/data/, so migrations/ is a
 * sibling directory. Bundled layout (`bun build --outdir dist`): the build
 * script copies migrations/ next to the output bundle, where import.meta.dir
 * points, so the same relative path resolves there too.
 */
function resolveMigrationsDir(): string {
    const dir = join(import.meta.dir, 'migrations');
    if (!existsSync(dir)) {
        throw new Error(`Migrations directory not found: ${dir}`);
    }
    return dir;
}

/**
 * Run all pending migrations against the database.
 *
 * @param db - Open bun:sqlite database connection
 * @throws When a migration fails (the transaction rolls back and the error
 *   propagates so the caller can abort startup)
 */
export function runMigrations(db: Database): void {
    db.run(`
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
        )
    `);

    const dir = resolveMigrationsDir();
    const files = readdirSync(dir)
        .filter(file => file.endsWith('.sql'))
        .sort();

    const appliedRows = db.query('SELECT name FROM _migrations').all() as Array<{ name: string }>;
    const applied = new Set(appliedRows.map(row => row.name));

    for (const name of files) {
        if (applied.has(name)) continue;

        const sql = readFileSync(join(dir, name), 'utf8');
        const migrate = db.transaction(() => {
            db.exec(sql);
            db.run('INSERT INTO _migrations (name) VALUES (?)', [name]);
        });
        migrate();
    }
}
