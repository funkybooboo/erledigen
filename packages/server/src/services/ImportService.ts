/**
 * ImportService -- import semantics for POST /api/import (ADR-009).
 *
 * Two modes, deliberately asymmetric:
 *
 * - RESTORE (format=json): a validated version-1 ExportSnapshot
 *   DESTRUCTIVELY replaces every application table -- tasks (trash
 *   included), Someday groups, projects, recurring templates, and the
 *   user preferences -- keeping the snapshot's ids, timestamps, and
 *   references verbatim. Referential integrity is free because the
 *   original ids are kept: merging would require id remapping and
 *   upsert-by-id is unsafe with sequential per-table ids (a snapshot
 *   id and a live id are different rows; see ADR-009).
 *
 * - IMPORT (csv, ics, todoist-csv, things-json): additive. Every parsed
 *   row becomes a NEW task with a NEW server id; existing data is
 *   never touched. Rows the source marks canceled land in the trash
 *   (created, then soft-deleted) instead of being dropped.
 *
 * A pre-restore backup file is written BEFORE any restore wipes data.
 */

import type {
    CsvColumnMapping,
    ExportSnapshot,
    ImportedTask,
    ImportResult,
    ParsedTasks,
    Task,
} from '@erledigen/shared';
import {
    CsvImportAdapter,
    IcalImportAdapter,
    JsonRestoreImportAdapter,
    ThingsJsonImportAdapter,
    TodoistCsvImportAdapter,
} from '@erledigen/shared';
import type { PreRestoreBackupWriter } from '../adapters/backup/PreRestoreBackupWriter';
import type { SnapshotRestoreWriter } from '../adapters/data/SnapshotRestoreWriter';
import type { TaskRepository } from '../adapters/data/TaskRepository';
import type { ExportService } from './ExportService';

/** What an additive import hands back to the route: the API result plus
 *  the created tasks so the route can broadcast per-task realtime
 *  events (task:created / task:deleted for canceled rows). */
export interface TaskImportOutcome {
    result: ImportResult;
    createdTasks: Task[];
    /** Ids of imported rows the source marked canceled (soft-deleted
     *  into the trash; realtime sees them as deletions). */
    canceledIds: string[];
}

/** One tree level of the imported task walk. */
interface LeveledTask {
    task: ImportedTask;
    parentId: string | null;
}

export class ImportService {
    private readonly jsonRestore = new JsonRestoreImportAdapter();

    constructor(
        private readonly taskRepo: TaskRepository,
        private readonly exportService: ExportService,
        private readonly restoreWriter: SnapshotRestoreWriter,
        private readonly backupWriter: PreRestoreBackupWriter,
    ) {}

    /** Destructive restore from a JSON export snapshot (ADR-009). */
    async restore(source: string): Promise<ImportResult> {
        // Parse + validate FIRST: a rejected snapshot wipes nothing.
        const snapshot: ExportSnapshot = this.jsonRestore.import(source);

        // Safety net before the wipe: back up the current state.
        const backupPath = await this.backupWriter.write(await this.exportService.buildSnapshot());

        // All-or-nothing across every table (see SnapshotRestoreWriter:
        // the async facade cannot compose a cross-table SQLite
        // transaction, so the write goes through the storage-specific
        // port whose failure rolls back everything).
        await this.restoreWriter.writeAll(snapshot);

        return {
            mode: 'restore',
            created: 0,
            restored: {
                tasks: snapshot.tasks.length,
                someDayGroups: snapshot.someDayGroups.length,
                projects: snapshot.projects.length,
                recurringTasks: snapshot.recurringTasks.length,
                preferences: true,
            },
            backupPath,
            warnings: [],
        };
    }

    /**
     * Additive import (ADR-009): every parsed task becomes a new row.
     * `mapping` is required only by the generic CSV format (when absent,
     * its columns are auto-detected from the header row).
     */
    async importTasks(
        format: 'csv' | 'ics' | 'todoist-csv' | 'things-json',
        source: string,
        mapping?: CsvColumnMapping,
    ): Promise<TaskImportOutcome> {
        const parsed: ParsedTasks =
            format === 'csv'
                ? new CsvImportAdapter(mapping).import(source)
                : format === 'ics'
                  ? new IcalImportAdapter().import(source)
                  : format === 'todoist-csv'
                    ? new TodoistCsvImportAdapter().import(source)
                    : new ThingsJsonImportAdapter().import(source);

        const createdTasks: Task[] = [];
        const canceledIds: string[] = [];
        let created = 0;

        // Walk the ImportedTask tree level by level: create a level
        // with createMany (one SQLite transaction per level), zip the
        // returned rows by index to attach the next level's children.
        let level: LeveledTask[] = parsed.tasks.map(task => ({ task, parentId: null }));
        while (level.length > 0) {
            const rows = await this.taskRepo.createMany(
                level.map(({ task, parentId }) => ({
                    text: task.text,
                    date: task.date,
                    notes: task.notes,
                    tags: task.tags,
                    parentId,
                    startTime: task.startTime,
                    endTime: task.endTime,
                    completed: task.completed,
                })),
            );
            createdTasks.push(...rows);
            created += rows.length;

            // Source-canceled rows land in the trash (restorable).
            const canceled = rows.filter((_row, index) => level[index]?.task.canceled === true);
            for (const row of canceled) {
                await this.taskRepo.delete(row.id);
                canceledIds.push(row.id);
            }

            level = level.flatMap(({ task }, index) => {
                const parent = rows[index];
                if (parent === undefined) return [];
                return task.subtasks.map(child => ({ task: child, parentId: parent.id }));
            });
        }

        return {
            result: {
                mode: 'import',
                created,
                restored: null,
                backupPath: null,
                warnings: parsed.warnings,
            },
            createdTasks,
            canceledIds,
        };
    }
}
