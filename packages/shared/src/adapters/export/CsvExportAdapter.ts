/**
 * CsvExportAdapter -- flat task list as RFC 4180 CSV.
 *
 * A readable view for spreadsheets and other tools, not a backup: only
 * ACTIVE tasks are included (soft-deleted rows are dropped -- the JSON
 * export is the lossless format). The column set is configurable; the
 * `priority` column is derived from the p1/p2/p3 tag convention (tags are
 * the domain model, not a separate field).
 */

import type { ExportSnapshot } from '../../types/export';
import { EXPORT_FORMAT_META } from '../../types/export';
import type { Task } from '../../types/task';
import type { ExportAdapter } from './ExportAdapter';

/** Every column the CSV export understands, in default order. */
export const DEFAULT_CSV_COLUMNS = [
    'id',
    'text',
    'notes',
    'completed',
    'date',
    'tags',
    'priority',
    'startTime',
    'endTime',
    'parentId',
    'someDayGroupId',
    'position',
    'state',
    'daysLate',
    'originalScheduledDate',
    'recurringTaskId',
    'instanceDate',
    'dependsOn',
    'createdAt',
    'updatedAt',
] as const;

export type CsvColumn = (typeof DEFAULT_CSV_COLUMNS)[number];

/** Priority resolution order for the derived `priority` column. */
const PRIORITY_TAGS = ['p1', 'p2', 'p3'] as const;

const COLUMN_GETTERS: Record<CsvColumn, (task: Task) => string> = {
    id: t => t.id,
    text: t => t.text,
    notes: t => t.notes ?? '',
    completed: t => String(t.completed),
    date: t => t.date ?? '',
    tags: t => t.tags.join(' '),
    priority: t => PRIORITY_TAGS.find(p => t.tags.includes(p)) ?? '',
    startTime: t => t.startTime ?? '',
    endTime: t => t.endTime ?? '',
    parentId: t => t.parentId ?? '',
    someDayGroupId: t => t.someDayGroupId ?? '',
    position: t => (t.position === null ? '' : String(t.position)),
    state: t => t.state ?? '',
    daysLate: t => String(t.daysLate),
    originalScheduledDate: t => t.originalScheduledDate ?? '',
    recurringTaskId: t => t.recurringTaskId ?? '',
    instanceDate: t => t.instanceDate ?? '',
    dependsOn: t => t.dependsOn ?? '',
    createdAt: t => t.createdAt,
    updatedAt: t => t.updatedAt,
};

/** Quote a cell when it contains a comma, quote, or line break (RFC 4180). */
function escapeCell(value: string): string {
    if (/[",\n\r]/.test(value)) {
        // Regex replace, not replaceAll: the server package's TS lib
        // target predates es2021's replaceAll.
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

export class CsvExportAdapter implements ExportAdapter {
    readonly extension = EXPORT_FORMAT_META.csv.extension;
    readonly contentType = EXPORT_FORMAT_META.csv.contentType;

    private readonly columns: readonly CsvColumn[];

    /**
     * @param columns - Column subset to emit; defaults to every column.
     *   Unknown names throw (programming error -- the API layer validates
     *   user input before reaching here).
     */
    constructor(columns: readonly string[] = DEFAULT_CSV_COLUMNS) {
        const unknown = columns.filter(
            c => !(DEFAULT_CSV_COLUMNS as readonly string[]).includes(c),
        );
        if (unknown.length > 0) {
            throw new Error(`Unknown CSV export column(s): ${unknown.join(', ')}`);
        }
        this.columns = columns as readonly CsvColumn[];
    }

    export(snapshot: ExportSnapshot): string {
        const rows = snapshot.tasks
            .filter(t => t.deletedAt === null)
            .map(task =>
                this.columns.map(column => escapeCell(COLUMN_GETTERS[column](task))).join(','),
            );
        const lines = [this.columns.join(','), ...rows];
        return `${lines.join('\r\n')}\r\n`;
    }
}
