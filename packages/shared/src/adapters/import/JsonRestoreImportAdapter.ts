/**
 * JsonRestoreImportAdapter -- parses an Erledigen export snapshot for a
 * destructive restore (ADR-008/ADR-009).
 *
 * Validation is strict: a restore rewrites every table, so the snapshot
 * must be a complete, self-consistent version-1 document before the
 * service wipes anything. Row-level problems are FATAL here (unlike the
 * additive import adapters, which skip bad rows and warn) -- a
 * half-restored backup silently violates the lossless contract.
 */

import type { ExportSnapshot } from '../../types/export';
import type { Project } from '../../types/project';
import type { RecurringTask } from '../../types/recurringTask';
import type { SomeDayGroup } from '../../types/someDayGroup';
import type { Task } from '../../types/task';
import type { UserPreferences } from '../../types/userPreferences';
import type { ImportAdapter } from './ImportAdapter';
import { ImportValidationError } from './ImportValidationError';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T/;

type Parsed = Partial<Record<keyof ExportSnapshot, unknown>>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(v => typeof v === 'string');
}

function optionalString(value: unknown): boolean {
    return value === null || typeof value === 'string';
}

/** Snapshot rows are validated with every key OPTIONAL and typed
 *  `unknown` -- named optional keys avoid index-signature access
 *  (noPropertyAccessFromIndexSignature) while keeping the checks
 *  exhaustive per field. */
interface TaskRow {
    id?: unknown;
    text?: unknown;
    notes?: unknown;
    completed?: unknown;
    date?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
    tags?: unknown;
    parentId?: unknown;
    rolloverEnabled?: unknown;
    someDayGroupId?: unknown;
    position?: unknown;
    state?: unknown;
    recurringTaskId?: unknown;
    instanceDate?: unknown;
    originalScheduledDate?: unknown;
    daysLate?: unknown;
    dependsOn?: unknown;
    startTime?: unknown;
    endTime?: unknown;
    reminder?: unknown;
    deletedAt?: unknown;
}

interface SomeDayGroupRow {
    id?: unknown;
    name?: unknown;
    description?: unknown;
    tag?: unknown;
    position?: unknown;
    createdAt?: unknown;
}

interface ProjectRow {
    id?: unknown;
    name?: unknown;
    tag?: unknown;
    description?: unknown;
    startDate?: unknown;
    dueDate?: unknown;
    isActive?: unknown;
    createdAt?: unknown;
    completedAt?: unknown;
}

interface RecurringTaskRow {
    id?: unknown;
    text?: unknown;
    notes?: unknown;
    tags?: unknown;
    frequency?: unknown;
    interval?: unknown;
    daysOfWeek?: unknown;
    dayOfMonth?: unknown;
    startDate?: unknown;
    endDate?: unknown;
    rolloverEnabled?: unknown;
    startTime?: unknown;
    createdAt?: unknown;
    updatedAt?: unknown;
}

interface PreferencesRow {
    theme?: unknown;
    locale?: unknown;
    someDayPanelWidth?: unknown;
    someDayPanelCollapsed?: unknown;
    someDayPanelLastOpenWidth?: unknown;
    rolloverEnabled?: unknown;
    rolloverTriggerTime?: unknown;
    showEmptyDays?: unknown;
    deleteConfirmation?: unknown;
    activeFilters?: unknown;
    tagKinds?: unknown;
    tagKindMap?: unknown;
    timeFormat?: unknown;
    updatedAt?: unknown;
}

function validateTask(task: unknown, index: number): Task {
    const where = `tasks[${index}]`;
    const fail = (msg: string): never => {
        throw new ImportValidationError(`Invalid snapshot: ${where}: ${msg}`);
    };
    if (!isRecord(task)) fail('expected a task object');
    const t = task as TaskRow;

    if (typeof t.id !== 'string' || t.id === '') fail('id must be a non-empty string');
    if (typeof t.text !== 'string' || t.text === '') fail('text must be a non-empty string');
    if (typeof t.completed !== 'boolean') fail('completed must be a boolean');
    if (t.date != null && (typeof t.date !== 'string' || !ISO_DATE.test(t.date)))
        fail('date must be null or a yyyy-MM-dd string');
    if (typeof t.createdAt !== 'string' || !ISO_TIMESTAMP.test(t.createdAt))
        fail('createdAt must be an ISO 8601 timestamp');
    if (typeof t.updatedAt !== 'string' || !ISO_TIMESTAMP.test(t.updatedAt))
        fail('updatedAt must be an ISO 8601 timestamp');
    if (!isStringArray(t.tags)) fail('tags must be an array of strings');
    if (!optionalString(t.notes)) fail('notes must be null or a string');
    if (!optionalString(t.parentId)) fail('parentId must be null or a string');
    if (!optionalString(t.someDayGroupId)) fail('someDayGroupId must be null or a string');
    if (!optionalString(t.recurringTaskId)) fail('recurringTaskId must be null or a string');
    if (!optionalString(t.instanceDate)) fail('instanceDate must be null or a string');
    if (!optionalString(t.originalScheduledDate))
        fail('originalScheduledDate must be null or a string');
    if (!optionalString(t.dependsOn)) fail('dependsOn must be null or a string');
    if (typeof t.rolloverEnabled !== 'boolean') fail('rolloverEnabled must be a boolean');
    if (typeof t.daysLate !== 'number') fail('daysLate must be a number');
    if (t.position != null && typeof t.position !== 'number')
        fail('position must be null or a number');
    if (t.state != null && !['ready', 'scheduled', 'done'].includes(t.state as string))
        fail("state must be null, 'ready', 'scheduled', or 'done'");
    if (t.startTime != null && (typeof t.startTime !== 'string' || !TIME.test(t.startTime)))
        fail('startTime must be null or an HH:MM string');
    if (t.endTime != null && (typeof t.endTime !== 'string' || !TIME.test(t.endTime)))
        fail('endTime must be null or an HH:MM string');
    if (
        t.deletedAt != null &&
        (typeof t.deletedAt !== 'string' || !ISO_TIMESTAMP.test(t.deletedAt))
    )
        fail('deletedAt must be null or an ISO 8601 timestamp');
    if (t.reminder != null) {
        if (!isRecord(t.reminder)) fail('reminder must be null or an object');
        const r = t.reminder as { time?: unknown; channels?: unknown };
        if (typeof r.time !== 'string' || !TIME.test(r.time))
            fail('reminder.time must be an HH:MM string');
        if (!Array.isArray(r.channels) || !r.channels.every(c => c === 'push' || c === 'email'))
            fail("reminder.channels must only contain 'push' or 'email'");
    }

    // Normalize the optional shape: missing optional keys read as null
    // (forward-compatible with additive snapshot changes per ADR-008).
    return {
        ...(task as Task),
        notes: (t.notes as string | null) ?? null,
        parentId: (t.parentId as string | null) ?? null,
        someDayGroupId: (t.someDayGroupId as string | null) ?? null,
        recurringTaskId: (t.recurringTaskId as string | null) ?? null,
        instanceDate: (t.instanceDate as string | null) ?? null,
        originalScheduledDate: (t.originalScheduledDate as string | null) ?? null,
        dependsOn: (t.dependsOn as string | null) ?? null,
        position: (t.position as number | null) ?? null,
        state: (t.state as Task['state']) ?? null,
        startTime: (t.startTime as string | null) ?? null,
        endTime: (t.endTime as string | null) ?? null,
        reminder: (t.reminder as Task['reminder']) ?? null,
        deletedAt: (t.deletedAt as string | null) ?? null,
    };
}

function validateSomeDayGroup(group: unknown, index: number): SomeDayGroup {
    const where = `someDayGroups[${index}]`;
    if (!isRecord(group)) {
        throw new ImportValidationError(`Invalid snapshot: ${where}: expected a group object`);
    }
    const g = group as SomeDayGroupRow;
    if (typeof g.id !== 'string' || g.id === '')
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: id must be a non-empty string`,
        );
    if (typeof g.name !== 'string' || g.name === '')
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: name must be a non-empty string`,
        );
    if (typeof g.tag !== 'string' || g.tag === '')
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: tag must be a non-empty string`,
        );
    if (typeof g.position !== 'number')
        throw new ImportValidationError(`Invalid snapshot: ${where}: position must be a number`);
    if (typeof g.createdAt !== 'string' || !ISO_TIMESTAMP.test(g.createdAt))
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: createdAt must be an ISO 8601 timestamp`,
        );
    if (!optionalString(g.description))
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: description must be null or a string`,
        );
    return group as unknown as SomeDayGroup;
}

function validateProject(project: unknown, index: number): Project {
    const where = `projects[${index}]`;
    if (!isRecord(project)) {
        throw new ImportValidationError(`Invalid snapshot: ${where}: expected a project object`);
    }
    const p = project as ProjectRow;
    if (typeof p.id !== 'string' || p.id === '')
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: id must be a non-empty string`,
        );
    if (typeof p.name !== 'string' || p.name === '')
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: name must be a non-empty string`,
        );
    if (typeof p.tag !== 'string' || p.tag === '')
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: tag must be a non-empty string`,
        );
    if (typeof p.isActive !== 'boolean')
        throw new ImportValidationError(`Invalid snapshot: ${where}: isActive must be a boolean`);
    if (typeof p.createdAt !== 'string' || !ISO_TIMESTAMP.test(p.createdAt))
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: createdAt must be an ISO 8601 timestamp`,
        );
    if (
        !optionalString(p.description) ||
        !optionalString(p.startDate) ||
        !optionalString(p.dueDate) ||
        !optionalString(p.completedAt)
    )
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: description/startDate/dueDate/completedAt must be null or strings`,
        );
    return project as unknown as Project;
}

function validateRecurringTask(rt: unknown, index: number): RecurringTask {
    const where = `recurringTasks[${index}]`;
    if (!isRecord(rt)) {
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: expected a recurring task object`,
        );
    }
    const r = rt as RecurringTaskRow;
    if (typeof r.id !== 'string' || r.id === '')
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: id must be a non-empty string`,
        );
    if (typeof r.text !== 'string' || r.text === '')
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: text must be a non-empty string`,
        );
    if (!isStringArray(r.tags))
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: tags must be an array of strings`,
        );
    if (typeof r.frequency !== 'string')
        throw new ImportValidationError(`Invalid snapshot: ${where}: frequency must be a string`);
    if (typeof r.interval !== 'number' || !Number.isInteger(r.interval) || r.interval < 1)
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: interval must be a positive integer`,
        );
    if (r.daysOfWeek !== null && r.daysOfWeek !== undefined && !Array.isArray(r.daysOfWeek))
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: daysOfWeek must be null or an array`,
        );
    if (r.dayOfMonth !== null && r.dayOfMonth !== undefined && typeof r.dayOfMonth !== 'number')
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: dayOfMonth must be null or a number`,
        );
    if (typeof r.startDate !== 'string' || !ISO_DATE.test(r.startDate))
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: startDate must be a yyyy-MM-dd string`,
        );
    if (!optionalString(r.endDate))
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: endDate must be null or a string`,
        );
    if (typeof r.rolloverEnabled !== 'boolean')
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: rolloverEnabled must be a boolean`,
        );
    if (
        r.startTime !== null &&
        r.startTime !== undefined &&
        (typeof r.startTime !== 'string' || !TIME.test(r.startTime))
    )
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: startTime must be null or an HH:MM string`,
        );
    if (typeof r.createdAt !== 'string' || !ISO_TIMESTAMP.test(r.createdAt))
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: createdAt must be an ISO 8601 timestamp`,
        );
    if (typeof r.updatedAt !== 'string' || !ISO_TIMESTAMP.test(r.updatedAt))
        throw new ImportValidationError(
            `Invalid snapshot: ${where}: updatedAt must be an ISO 8601 timestamp`,
        );
    return rt as unknown as RecurringTask;
}

function validateUserPreferences(prefs: unknown): UserPreferences {
    if (!isRecord(prefs)) {
        throw new ImportValidationError('Invalid snapshot: userPreferences must be an object');
    }
    const p = prefs as PreferencesRow;
    const required = [
        'theme',
        'locale',
        'someDayPanelWidth',
        'someDayPanelCollapsed',
        'someDayPanelLastOpenWidth',
        'rolloverEnabled',
        'rolloverTriggerTime',
        'showEmptyDays',
        'deleteConfirmation',
        'activeFilters',
        'tagKinds',
        'tagKindMap',
        'timeFormat',
        'updatedAt',
    ];
    const missing = required.filter(key => !(key in p));
    if (missing.length > 0) {
        throw new ImportValidationError(
            `Invalid snapshot: userPreferences is missing: ${missing.join(', ')}`,
        );
    }
    return prefs as unknown as UserPreferences;
}

/** Cross-entity references must resolve WITHIN the snapshot: after a
 *  restore there is no other data for them to point at. */
function validateReferences(snapshot: ExportSnapshot): void {
    const taskIds = new Set(snapshot.tasks.map(t => t.id));
    const groupIds = new Set(snapshot.someDayGroups.map(g => g.id));
    const projectIds = new Set(snapshot.projects.map(p => p.id));
    const recurringIds = new Set(snapshot.recurringTasks.map(r => r.id));

    for (const [index, task] of snapshot.tasks.entries()) {
        const where = `tasks[${index}] (${task.id})`;
        if (task.parentId !== null && !taskIds.has(task.parentId)) {
            throw new ImportValidationError(
                `Invalid snapshot: ${where}: parentId ${task.parentId} does not exist in the snapshot`,
            );
        }
        if (task.someDayGroupId !== null && !groupIds.has(task.someDayGroupId)) {
            throw new ImportValidationError(
                `Invalid snapshot: ${where}: someDayGroupId ${task.someDayGroupId} does not exist in the snapshot`,
            );
        }
        if (task.recurringTaskId !== null && !recurringIds.has(task.recurringTaskId)) {
            throw new ImportValidationError(
                `Invalid snapshot: ${where}: recurringTaskId ${task.recurringTaskId} does not exist in the snapshot`,
            );
        }
        if (task.dependsOn !== null && !taskIds.has(task.dependsOn)) {
            throw new ImportValidationError(
                `Invalid snapshot: ${where}: dependsOn ${task.dependsOn} does not exist in the snapshot`,
            );
        }
    }
    // The task repo is the only one whose ids appear above; projects and
    // groups have no outbound references.
    void projectIds;
}

export class JsonRestoreImportAdapter implements ImportAdapter<ExportSnapshot> {
    readonly format = 'json';

    /** Parse and validate a version-1 Erledigen export snapshot. */
    import(source: string): ExportSnapshot {
        let parsed: unknown;
        try {
            parsed = JSON.parse(source);
        } catch {
            throw new ImportValidationError('Not a valid JSON document');
        }
        if (!isRecord(parsed)) {
            throw new ImportValidationError('Expected an Erledigen export snapshot object');
        }
        const doc = parsed as Parsed;

        if (doc.format !== 'erledigen-export') {
            throw new ImportValidationError(
                "Not an Erledigen export: missing format: 'erledigen-export'",
            );
        }
        if (doc.version !== 1) {
            throw new ImportValidationError(
                `Unsupported export version: ${String(doc.version)} (this server restores version 1)`,
            );
        }

        if (!Array.isArray(doc.tasks)) {
            throw new ImportValidationError('Invalid snapshot: tasks must be an array');
        }
        if (!Array.isArray(doc.someDayGroups)) {
            throw new ImportValidationError('Invalid snapshot: someDayGroups must be an array');
        }
        if (!Array.isArray(doc.projects)) {
            throw new ImportValidationError('Invalid snapshot: projects must be an array');
        }
        if (!Array.isArray(doc.recurringTasks)) {
            throw new ImportValidationError('Invalid snapshot: recurringTasks must be an array');
        }
        if (typeof doc.exportedAt !== 'string' || !ISO_TIMESTAMP.test(doc.exportedAt)) {
            throw new ImportValidationError(
                'Invalid snapshot: exportedAt must be an ISO 8601 timestamp',
            );
        }

        const snapshot: ExportSnapshot = {
            format: 'erledigen-export',
            version: 1,
            exportedAt: doc.exportedAt,
            tasks: doc.tasks.map(validateTask),
            someDayGroups: doc.someDayGroups.map(validateSomeDayGroup),
            projects: doc.projects.map(validateProject),
            recurringTasks: doc.recurringTasks.map(validateRecurringTask),
            userPreferences: validateUserPreferences(doc.userPreferences),
        };

        const taskIds = snapshot.tasks.map(t => t.id);
        if (new Set(taskIds).size !== taskIds.length) {
            throw new ImportValidationError('Invalid snapshot: duplicate task ids');
        }

        validateReferences(snapshot);
        return snapshot;
    }
}
