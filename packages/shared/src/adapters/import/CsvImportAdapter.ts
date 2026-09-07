/**
 * CsvImportAdapter -- generic task CSV with column mapping (ADR-009).
 *
 * Additive source: every row becomes a NEW task; existing data is never
 * touched. Columns are mapped to Erledigen fields either explicitly
 * (the Settings mapping UI) or by auto-detecting common header names
 * ("text/title/task", "due date", "start time", ...), so our own CSV
 * export re-imports without any mapping UI at all. Rows that fail
 * field validation are skipped with a warning; the rest import.
 */

import { TASK_CONSTRAINTS } from '../../constants';
import type {
    CsvColumnMapping,
    CsvImportField,
    ImportedTask,
    ImportIssue,
    ParsedTasks,
} from '../../types/import';
import { CSV_IMPORT_FIELDS } from '../../types/import';
import type { ImportAdapter } from './ImportAdapter';
import { ImportValidationError } from './ImportValidationError';
import { parseCsv } from './parseCsv';

const TIME = /^\d{2}:\d{2}$/;
const MAX_WARNINGS = 100;

/** Case-insensitive, punctuation-free header matching. */
function normalizeHeader(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

/** Known header names per field, most specific first. */
const HEADER_ALIASES: Record<CsvImportField, readonly string[]> = {
    text: ['text', 'title', 'task', 'name', 'summary', 'subject', 'content', 'todo', 'item'],
    notes: ['notes', 'note', 'description', 'details'],
    date: ['date', 'duedate', 'due', 'when', 'day'],
    tags: ['tags', 'tag', 'labels', 'label', 'categories'],
    completed: ['completed', 'complete', 'done', 'status', 'checked', 'isdone', 'iscomplete'],
    priority: ['priority', 'prio'],
    startTime: ['starttime', 'start', 'time', 'from', 'begins'],
    endTime: ['endtime', 'end', 'until', 'to'],
};

const TRUTHY = new Set(['true', '1', 'yes', 'y', 'x', 'done', 'completed', 'complete']);
const PRIORITY_TAGS = ['p1', 'p2', 'p3'] as const;

/** Auto-detect a column mapping from a CSV header row. */
export function autoDetectCsvMapping(header: readonly string[]): CsvColumnMapping {
    const mapping: CsvColumnMapping = {};
    const used = new Set<string>();
    for (const field of CSV_IMPORT_FIELDS) {
        const alias = HEADER_ALIASES[field];
        const found = header.find(name => !used.has(name) && alias.includes(normalizeHeader(name)));
        if (found !== undefined) {
            mapping[field] = found;
            used.add(found);
        }
    }
    return mapping;
}

export class CsvImportAdapter implements ImportAdapter<ParsedTasks> {
    readonly format = 'csv';

    private readonly mapping: CsvColumnMapping | null;

    /**
     * @param mapping - Column mapping (Erledigen field -> source header
     *   name). When omitted, the header row is auto-detected on import.
     */
    constructor(mapping?: CsvColumnMapping) {
        this.mapping = mapping ?? null;
    }

    /** Column headers of the first CSV row -- for the mapping UI. */
    static readHeader(source: string): string[] {
        const rows = parseCsv(source);
        return rows[0] ?? [];
    }

    import(source: string): ParsedTasks {
        const rows = parseCsv(source);
        if (rows.length === 0) {
            throw new ImportValidationError('Empty CSV document');
        }
        const header = rows[0];
        if (header === undefined) {
            throw new ImportValidationError('Empty CSV document');
        }
        const mapping = this.mapping ?? autoDetectCsvMapping(header);
        if (mapping.text === null || mapping.text === undefined) {
            throw new ImportValidationError(
                'No text column: map the task text column first ' +
                    `(available columns: ${header.join(', ')})`,
            );
        }
        const columnIndex = new Map<string, number>(
            header.map((name, index) => [name, index] as const),
        );
        const cell = (row: string[], field: CsvImportField): string | null => {
            const column = mapping[field];
            if (column === null || column === undefined) return null;
            const index = columnIndex.get(column);
            return index === undefined ? null : (row[index] ?? null);
        };

        const tasks: ImportedTask[] = [];
        const warnings: ImportIssue[] = [];
        for (const [rowNumber, row] of rows.slice(1).entries()) {
            const sourceRow = rowNumber + 2; // 1-based, header is row 1
            const skip = (message: string): void => {
                if (warnings.length < MAX_WARNINGS) {
                    warnings.push({ source: sourceRow, message });
                }
            };
            if (row.every(c => c.trim() === '')) continue; // blank line

            const text = (cell(row, 'text') ?? '').trim();
            if (text === '') {
                skip('missing task text');
                continue;
            }
            if (text.length > TASK_CONSTRAINTS.MAX_TEXT_LENGTH) {
                skip(`task text longer than ${TASK_CONSTRAINTS.MAX_TEXT_LENGTH} characters`);
                continue;
            }

            let date: string | null = null;
            const rawDate = cell(row, 'date');
            if (rawDate !== null && rawDate.trim() !== '') {
                const trimmed = rawDate.trim();
                // Accept the ISO form with an optional trailing time part
                // ("2026-01-15 09:00" -> date only; map the time separately
                // unless a start time column is also mapped).
                const match = /^(\d{4}-\d{2}-\d{2})($|\s)/.exec(trimmed);
                if (match === null || match[1] === undefined) {
                    skip(`date "${trimmed}" is not a yyyy-MM-dd date`);
                    continue;
                }
                date = match[1];
            }

            let startTime: string | null = null;
            const rawStart = cell(row, 'startTime');
            if (rawStart !== null && rawStart.trim() !== '') {
                const trimmed = rawStart.trim();
                const match = TIME.exec(trimmed);
                if (match === null) {
                    skip(`start time "${trimmed}" is not an HH:MM time`);
                    continue;
                }
                startTime = match[0];
            }

            let endTime: string | null = null;
            const rawEnd = cell(row, 'endTime');
            if (rawEnd !== null && rawEnd.trim() !== '') {
                const trimmed = rawEnd.trim();
                const match = TIME.exec(trimmed);
                if (match === null) {
                    skip(`end time "${trimmed}" is not an HH:MM time`);
                    continue;
                }
                endTime = match[0];
            }

            const completedRaw = cell(row, 'completed');
            const completed =
                completedRaw !== null ? TRUTHY.has(completedRaw.trim().toLowerCase()) : false;

            const priorityRaw = cell(row, 'priority');
            const priority = priorityRaw?.trim().toLowerCase() ?? '';
            const priorityTag = (PRIORITY_TAGS as readonly string[]).includes(priority)
                ? priority
                : null;

            const tagsRaw = cell(row, 'tags');
            const tags = (tagsRaw ?? '')
                .split(/[\s,;]+/)
                .map(tag => tag.trim())
                .filter(tag => tag !== '');
            if (priorityTag !== null) tags.push(priorityTag);

            tasks.push({
                text,
                notes: cell(row, 'notes')?.trim() ?? null,
                date,
                startTime,
                endTime,
                tags,
                completed,
                canceled: false,
                subtasks: [],
            });
        }

        return { tasks, warnings };
    }
}
