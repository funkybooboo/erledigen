/**
 * PreRestoreBackupWriter port: before a destructive restore (ADR-009),
 * the server writes the current state to a JSON file next to the
 * database, so even a mistaken restore is itself restorable. The
 * container wires a file writer for the SQLite adapter and nothing for
 * in-memory runs (there is no data to back up).
 */

import type { ExportSnapshot } from '@erledigen/shared';

export interface PreRestoreBackupWriter {
    /**
     * Persist the given snapshot; return its path, or null when the
     * adapter has no backup location (in-memory storage).
     */
    write(snapshot: ExportSnapshot): Promise<string | null>;
}

/** Null object for in-memory runs: no file, no backup path reported. */
export class NullPreRestoreBackupWriter implements PreRestoreBackupWriter {
    write(): Promise<string | null> {
        return Promise.resolve(null);
    }
}
