/**
 * Export format contract (see ADR-008).
 *
 * The JSON export is the canonical, lossless backup format: every entity
 * (tasks including the trash, Someday groups, projects, recurring task
 * templates, user preferences) round-trips through it. CSV, Markdown, and
 * iCal are derived views of the task list -- readable by other tools, but
 * not backups.
 */

import type { Project } from './project';
import type { RecurringTask } from './recurringTask';
import type { SomeDayGroup } from './someDayGroup';
import type { Task } from './task';
import type { UserPreferences } from './userPreferences';

/** Export formats supported by GET /api/export. */
export const EXPORT_FORMATS = ['json', 'csv', 'md', 'ics'] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/** File extension and media type per format -- the single source of truth
 *  shared by the export adapters (server) and the download naming (client),
 *  so the two can never drift. */
export const EXPORT_FORMAT_META: Record<ExportFormat, { extension: string; contentType: string }> =
    {
        json: { extension: 'json', contentType: 'application/json' },
        csv: { extension: 'csv', contentType: 'text/csv' },
        md: { extension: 'md', contentType: 'text/markdown' },
        ics: { extension: 'ics', contentType: 'text/calendar' },
    };

/**
 * Canonical export snapshot (ADR-008).
 *
 * Stability commitment: the shape of this object (field names and types
 * listed below) is the documented backup format. New optional fields may
 * be ADDED without a version bump; removing or retyping a field requires
 * `version: 2` and an import path that understands both.
 */
export interface ExportSnapshot {
    /** Discriminator; always 'erledigen-export'. */
    format: 'erledigen-export';
    /** Snapshot schema version (see ADR-008). */
    version: 1;
    /** ISO 8601 UTC timestamp of the export. */
    exportedAt: string;
    /** Every task, INCLUDING soft-deleted (trash) rows. */
    tasks: Task[];
    someDayGroups: SomeDayGroup[];
    projects: Project[];
    recurringTasks: RecurringTask[];
    userPreferences: UserPreferences;
}
