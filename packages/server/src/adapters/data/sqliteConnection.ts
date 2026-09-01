/**
 * SQLite connection wrapper (see ADR-001)
 *
 * Opens the database file, enables WAL for a long-lived server process, and
 * runs pending migrations before anything else touches the schema. A single
 * connection is shared by all Sqlite* repositories — bun:sqlite is
 * synchronous, so no pooling is needed for single-user workloads.
 */

import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { runMigrations } from './migrationRunner';

export class SqliteConnection {
    public readonly db: Database;

    /**
     * @param dbPath - File path to the database, or ':memory:' for an
     *   ephemeral in-file-system database (used by tests)
     */
    constructor(dbPath: string) {
        if (dbPath !== ':memory:') {
            mkdirSync(dirname(dbPath), { recursive: true });
        }
        this.db = new Database(dbPath);
        // WAL survives process crashes better and keeps reads fast while a
        // write is in flight. No-op (returns 'memory') for :memory: dbs.
        this.db.exec('PRAGMA journal_mode = WAL;');
        runMigrations(this.db);
    }

    close(): void {
        this.db.close();
    }
}
