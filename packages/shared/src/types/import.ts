/**
 * Import format contract (see ADR-008 and ADR-009).
 *
 * JSON is the restore format: a version-1 ExportSnapshot replaces ALL
 * application data (destructive restore -- including preferences, the
 * trash, and every entity kind). CSV, iCal, Todoist CSV, and Things 3
 * JSON are additive task sources: they import new tasks and never touch
 * existing data.
 */

/**
 * Import formats accepted by POST /api/import.
 *
 * 'json' restores an Erledigen export; the rest import tasks from other
 * tools and file conventions.
 */
export const IMPORT_FORMATS = ['json', 'csv', 'ics', 'todoist-csv', 'things-json'] as const;

export type ImportFormat = (typeof IMPORT_FORMATS)[number];

/** Display metadata per import format -- the single source of truth for
 *  the Settings import UI (label + file-picker accept hint) and the
 *  OpenAPI docs, mirroring EXPORT_FORMAT_META. */
export const IMPORT_FORMAT_META: Record<
    ImportFormat,
    { label: string; extension: string; restore: boolean }
> = {
    json: { label: 'Erledigen backup (JSON)', extension: 'json', restore: true },
    csv: { label: 'Generic task CSV', extension: 'csv', restore: false },
    ics: { label: 'iCal calendar (.ics)', extension: 'ics', restore: false },
    'todoist-csv': { label: 'Todoist CSV export', extension: 'csv', restore: false },
    'things-json': { label: 'Things 3 JSON export', extension: 'json', restore: false },
};

/** A sub-task parsed from an import source. Sub-tasks carry the same
 *  shape as their parents (Todoist's INDENT column nests arbitrary
 *  levels deep; Things checklists nest one level). */
export interface ImportedTask {
    text: string;
    notes: string | null;
    /** Local yyyy-MM-dd key string, or null to import to Someday. */
    date: string | null;
    startTime: string | null;
    endTime: string | null;
    tags: string[];
    completed: boolean;
    /** The source marks the item canceled (Things 3). Additive import
     *  lands canceled items in the trash instead of dropping them. */
    canceled: boolean;
    subtasks: ImportedTask[];
}

/** A non-fatal problem found while parsing: the related row/item was
 *  skipped (additive formats) or the issue is informational. */
export interface ImportIssue {
    /** 1-based source row or item index, when the issue maps to one. */
    source?: number;
    message: string;
}

/** Result of parsing an additive import source. */
export interface ParsedTasks {
    tasks: ImportedTask[];
    warnings: ImportIssue[];
}

/** Summary returned by POST /api/import. */
export interface ImportResult {
    /** 'restore' = destructive JSON snapshot replace; 'import' = additive. */
    mode: 'restore' | 'import';
    /** Tasks created (additive import, sub-tasks included). */
    created: number;
    /** Entities restored from a JSON snapshot (restore mode). */
    restored: {
        tasks: number;
        someDayGroups: number;
        projects: number;
        recurringTasks: number;
        /** Preferences are always part of a restore. */
        preferences: true;
    } | null;
    /** Server-side pre-restore backup path (restore mode, file-backed
     *  storage only; null for in-memory runs and additive imports). */
    backupPath: string | null;
    /** Non-fatal issues: skipped rows with reasons (capped). */
    warnings: ImportIssue[];
}

/** Erledigen task fields a generic CSV column can be mapped to. */
export const CSV_IMPORT_FIELDS = [
    'text',
    'notes',
    'date',
    'tags',
    'completed',
    'priority',
    'startTime',
    'endTime',
] as const;

export type CsvImportField = (typeof CSV_IMPORT_FIELDS)[number];

/** Generic CSV column mapping: Erledigen field -> source header name.
 *  Unmapped fields (missing keys or null values) import as empty. */
export type CsvColumnMapping = Partial<Record<CsvImportField, string | null>>;
