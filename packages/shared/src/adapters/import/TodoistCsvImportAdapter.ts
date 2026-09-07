/**
 * TodoistCsvImportAdapter -- Todoist's CSV export format (ADR-009).
 *
 * Additive source: every TYPE=task row becomes a NEW task; existing
 * data is never touched. Header sets vary between Todoist versions
 * (older exports lack DESCRIPTION/DURATION/DEADLINE...), so parsing is
 * header-NAME driven, not position driven.
 *
 * Mapping (column -> Erledigen):
 * - TYPE:      'task' imports; 'note' appends to the previous task's
 *              notes; 'section'/'project' rows are skipped (Erledigen
 *              has no sections; use the JSON restore for full backups).
 * - CONTENT:   task text; `@label` tokens become tags and are stripped.
 * - DESCRIPTION: notes.
 * - PRIORITY:  Todoist CSV template values 1-4 where 1 = p1 (HIGHEST);
 *              maps to the p1/p2/p3 tag convention, 4 = no tag.
 * - INDENT:    1 = top level; deeper levels become sub-tasks of the
 *              nearest preceding row at INDENT-1 (arbitrary depth).
 * - DATE:      absolute "yyyy-MM-dd[ HH:MM[:SS]]" imports date (+time);
 *              recurring or relative strings ("every Monday", "in 5
 *              days") import undated (Someday) with a warning.
 *
 * Completed tasks are not part of a Todoist CSV export; there is no
 * completion column to read.
 */

import { TASK_CONSTRAINTS } from '../../constants';
import type { ImportedTask, ImportIssue, ParsedTasks } from '../../types/import';
import type { ImportAdapter } from './ImportAdapter';
import { ImportValidationError } from './ImportValidationError';
import { parseCsv } from './parseCsv';

const MAX_WARNINGS = 100;

/** Label tokens inside CONTENT: `@labelname` (letters, digits, `-`, `_`,
 *  `/`), per Todoist's documented label syntax. */
const LABEL_TOKEN = /(?:^|\s)@([A-Za-z0-9/_-]+)/g;

/** Absolute due date: yyyy-MM-DD optionally followed by a time. */
const ABSOLUTE_DATE = /^(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}):(\d{2}))?/;

/** Todoist PRIORITY (CSV template) -> priority tag. 1 = p1 highest. */
function priorityTag(priority: string): string | null {
    switch (priority.trim()) {
        case '1':
            return 'p1';
        case '2':
            return 'p2';
        case '3':
            return 'p3';
        default:
            return null; // '4' = lowest: no Erledigen priority tag
    }
}

interface Row {
    type: string;
    content: string;
    description: string;
    priority: string;
    /** Raw INDENT cell ("1"-"4"), parsed inside pushTask. */
    indent: string;
    date: string;
}

export class TodoistCsvImportAdapter implements ImportAdapter<ParsedTasks> {
    readonly format = 'todoist-csv';

    import(source: string): ParsedTasks {
        const rows = parseCsv(source);
        if (rows.length === 0) {
            throw new ImportValidationError('Empty CSV document');
        }
        const headerRow = rows[0];
        if (headerRow === undefined) {
            throw new ImportValidationError('Empty CSV document');
        }
        const header = headerRow.map(name => name.trim().toUpperCase());
        const column = new Map(header.map((name, index) => [name, index] as const));
        const contentIndex = column.get('CONTENT');
        const typeIndex = column.get('TYPE');
        if (contentIndex === undefined || typeIndex === undefined) {
            throw new ImportValidationError(
                'Not a Todoist CSV export (no TYPE/CONTENT header columns)',
            );
        }
        const at = (row: string[], name: string): string => {
            const index = column.get(name);
            return index === undefined ? '' : (row[index] ?? '');
        };

        const tasks: ImportedTask[] = [];
        const warnings: ImportIssue[] = [];
        const warn = (sourceRow: number, message: string): void => {
            if (warnings.length < MAX_WARNINGS) warnings.push({ source: sourceRow, message });
        };

        /** INDENT stack: index 0 = top level; the last task at each depth. */
        let stack: ImportedTask[] = [];
        let lastTask: ImportedTask | null = null;

        /** Import one TYPE=task row; returns the created task (or null for
         *  skipped rows) so note rows can attach to it. */
        const pushTask = (row: Row, sourceRow: number): ImportedTask | null => {
            // Extract `@label` tokens; leave other text intact.
            const tags: string[] = [];
            const text = row.content
                .replace(LABEL_TOKEN, (_match, label: string) => {
                    tags.push(label);
                    return ' ';
                })
                .replace(/\s+/g, ' ')
                .trim();

            if (text === '') {
                warn(sourceRow, 'task row without text skipped');
                stack = [];
                return null;
            }
            if (text.length > TASK_CONSTRAINTS.MAX_TEXT_LENGTH) {
                warn(
                    sourceRow,
                    `task text longer than ${TASK_CONSTRAINTS.MAX_TEXT_LENGTH} characters skipped`,
                );
                return null;
            }

            let date: string | null = null;
            let startTime: string | null = null;
            const rawDate = row.date.trim();
            if (rawDate !== '') {
                const match = ABSOLUTE_DATE.exec(rawDate);
                if (match !== null && match[1] !== undefined) {
                    date = match[1];
                    if (
                        match[2] !== undefined &&
                        match[3] !== undefined &&
                        Number(match[2]) <= 23 &&
                        Number(match[3]) <= 59
                    ) {
                        startTime = `${match[2]}:${match[3]}`;
                    }
                } else {
                    warn(
                        sourceRow,
                        `due date "${rawDate}" (recurring or relative) imported undated`,
                    );
                }
            }

            const tag = priorityTag(row.priority);
            if (tag !== null) tags.push(tag);

            const task: ImportedTask = {
                text,
                notes: row.description.trim() === '' ? null : row.description.trim(),
                date,
                startTime,
                endTime: null,
                tags,
                completed: false, // exports never include completed tasks
                canceled: false,
                subtasks: [],
            };

            const indent = Math.max(1, Number.parseInt(row.indent, 10) || 1);
            if (indent === 1 || stack.length === 0) {
                tasks.push(task);
                stack = [task];
            } else {
                const parent = stack[indent - 2];
                if (parent === undefined) {
                    tasks.push(task); // broken indent: promote to top level
                } else {
                    parent.subtasks.push(task);
                }
                stack = [...stack.slice(0, indent - 1), task];
            }
            return task;
        };

        for (const [rowNumber, row] of rows.slice(1).entries()) {
            const sourceRow = rowNumber + 2; // 1-based, header is row 1
            const type = (row[typeIndex] ?? '').trim().toLowerCase();
            if (row.every(cell => cell.trim() === '')) continue; // blank row

            if (type === 'note') {
                // Notes attach to the task ABOVE them in the export.
                const content = row[contentIndex] ?? '';
                if (content.trim() === '' || lastTask === null) {
                    if (content.trim() !== '')
                        warn(sourceRow, 'note without a preceding task skipped');
                    continue;
                }
                const cleaned = content.replace(/\[\[file[\s\S]*?\]\]/g, '').trim();
                if (cleaned === '') continue; // attachment-only note
                lastTask.notes =
                    lastTask.notes === null ? cleaned : `${lastTask.notes}\n${cleaned}`;
                continue;
            }
            if (type === 'section' || type === 'project') {
                warn(sourceRow, `${type} row "${(row[contentIndex] ?? '').trim()}" skipped`);
                stack = [];
                continue;
            }
            if (type !== 'task') {
                warn(sourceRow, `unknown row type "${type}" skipped`);
                continue;
            }

            lastTask = pushTask(
                {
                    type,
                    content: row[contentIndex] ?? '',
                    description: at(row, 'DESCRIPTION'),
                    priority: at(row, 'PRIORITY'),
                    indent: at(row, 'INDENT'),
                    date: at(row, 'DATE'),
                },
                sourceRow,
            );
        }

        return { tasks, warnings };
    }
}
