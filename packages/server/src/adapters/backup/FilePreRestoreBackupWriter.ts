/**
 * File-based pre-restore backups (ADR-009): before a destructive JSON
 * restore, the server writes the current state as an Erledigen export
 * document next to the database file, so a mistaken restore is itself
 * restorable. Backup files accumulate; the user manages/prunes the
 * data directory like any backup folder.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExportSnapshot } from '@erledigen/shared';
import type { PreRestoreBackupWriter } from './PreRestoreBackupWriter';

export class FilePreRestoreBackupWriter implements PreRestoreBackupWriter {
    /**
     * @param directory - Directory for backup files (the SQLite DB's
     *   directory; see Container).
     */
    constructor(private readonly directory: string) {}

    write(snapshot: ExportSnapshot): Promise<string | null> {
        mkdirSync(this.directory, { recursive: true });
        // Filesystem-safe timestamp (colons are not portable in paths).
        const safe = snapshot.exportedAt.replace(/[:.]/g, '-');
        const path = join(this.directory, `erledigen-pre-restore-${safe}.json`);
        writeFileSync(path, JSON.stringify(snapshot, null, 2));
        return Promise.resolve(path);
    }
}
