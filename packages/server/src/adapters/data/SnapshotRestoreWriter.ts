/**
 * SnapshotRestoreWriter port (ADR-009): the all-tables destructive
 * restore write. Kept separate from the repository interfaces because
 * ATOMICITY ACROSS TABLES is storage-specific:
 *
 * - SQLite: every replaceAll must happen inside ONE transaction. An
 *   async facade cannot do this (a rejected promise escapes the
 *   transaction callback, which then commits the partial writes) -- the
 *   SQLite implementation composes the repositories' synchronous
 *   replaceAllSync/restoreSync cores inside a single transaction.
 * - In-memory: sequential writes (all synchronous under the async
 *   facade; there is no cross-table durability to protect).
 */

import type { ExportSnapshot } from '@erledigen/shared';
import type { ProjectRepository } from './ProjectRepository';
import type { RecurringTaskRepository } from './RecurringTaskRepository';
import type { SomeDayGroupRepository } from './SomeDayGroupRepository';
import type { SqliteProjectRepository } from './SqliteProjectRepository';
import type { SqliteRecurringTaskRepository } from './SqliteRecurringTaskRepository';
import type { SqliteSomeDayGroupRepository } from './SqliteSomeDayGroupRepository';
import type { SqliteTaskRepository } from './SqliteTaskRepository';
import type { SqliteUserPreferencesRepository } from './SqliteUserPreferencesRepository';
import type { SqliteConnection } from './sqliteConnection';
import type { TaskRepository } from './TaskRepository';
import type { UserPreferencesRepository } from './UserPreferencesRepository';

export interface SnapshotRestoreWriter {
    /** Replace EVERY application table with the snapshot, verbatim
     *  (ids, timestamps, trash, preferences). Throws (rolling every
     *  table back) when any write fails. */
    writeAll(snapshot: ExportSnapshot): Promise<void>;
}

/** In-memory wiring: sequential replaceAll calls against the live
 *  repositories (in-memory repos are STATEFUL -- the writer must target
 *  the app's actual instances, not fresh ones). */
export class InMemorySnapshotRestoreWriter implements SnapshotRestoreWriter {
    constructor(
        private readonly taskRepo: TaskRepository,
        private readonly groupRepo: SomeDayGroupRepository,
        private readonly projectRepo: ProjectRepository,
        private readonly recurringRepo: RecurringTaskRepository,
        private readonly prefsRepo: UserPreferencesRepository,
    ) {}

    async writeAll(snapshot: ExportSnapshot): Promise<void> {
        await this.taskRepo.replaceAll(snapshot.tasks);
        await this.groupRepo.replaceAll(snapshot.someDayGroups);
        await this.projectRepo.replaceAll(snapshot.projects);
        await this.recurringRepo.replaceAll(snapshot.recurringTasks);
        await this.prefsRepo.restore(snapshot.userPreferences);
    }
}

/** SQLite wiring: one transaction around every table (see the port's
 *  doc comment for why the synchronous cores are required here). */
export class SqliteSnapshotRestoreWriter implements SnapshotRestoreWriter {
    constructor(
        private readonly connection: SqliteConnection,
        private readonly taskRepo: SqliteTaskRepository,
        private readonly groupRepo: SqliteSomeDayGroupRepository,
        private readonly projectRepo: SqliteProjectRepository,
        private readonly recurringRepo: SqliteRecurringTaskRepository,
        private readonly prefsRepo: SqliteUserPreferencesRepository,
    ) {}

    async writeAll(snapshot: ExportSnapshot): Promise<void> {
        // Sync cores + a sync transaction callback: any throw rolls
        // every table back. The repos' own transactions nest as
        // savepoints (bun:sqlite supports nested transactions).
        this.connection.transaction(() => {
            this.taskRepo.replaceAllSync(snapshot.tasks);
            this.groupRepo.replaceAllSync(snapshot.someDayGroups);
            this.projectRepo.replaceAllSync(snapshot.projects);
            this.recurringRepo.replaceAllSync(snapshot.recurringTasks);
            this.prefsRepo.restoreSync(snapshot.userPreferences);
        });
        return Promise.resolve();
    }
}
