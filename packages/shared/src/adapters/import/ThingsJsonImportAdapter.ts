/**
 * ThingsJsonImportAdapter -- Things 3 JSON exports (ADR-009).
 *
 * Additive source: every to-do becomes a NEW task; existing data is
 * never touched. The accepted document is the array shape produced by
 * `things-cli --json ...` (built on things.py / the thingsapi JSON
 * schema): a top-level JSON array of task dictionaries with fields
 *
 *   uuid, type ('to-do'|'project'|'heading'), title, subtitle, notes,
 *   status ('incomplete'|'completed'|'canceled'), start
 *   ('Inbox'|'Anytime'|'Someday'), start_date/deadline ('yyyy-MM-dd'),
 *   stop_date/created/modified ('yyyy-MM-dd HH:MM:SS'), reminder_time
 *   ('HH:MM'), tags (array of titles), checklist (array of item dicts
 *   with title + status).
 *
 * Mapping notes:
 * - Only type 'to-do' imports; 'project'/'heading' rows are skipped
 *   with a warning (Erledigen projects are a different entity kind --
 *   the JSON restore is the lossless path).
 * - start_date maps to the task date; to-dos without one (Someday,
 *   Inbox, dateless Anytime) import to the Someday list.
 * - reminder_time maps to startTime (Things has no end time).
 * - deadline has no Erledigen field: it is appended to the notes
 *   ("Deadline: yyyy-MM-dd") instead of being dropped.
 * - checklist items become sub-tasks (completed/canceled status kept).
 * - 'canceled' to-dos import into the trash (Erledigen's closest
 *   equivalent of Things' canceled bucket): restorable, never lost.
 */

import { TASK_CONSTRAINTS } from '../../constants';
import type { ImportedTask, ImportIssue, ParsedTasks } from '../../types/import';
import type { ImportAdapter } from './ImportAdapter';
import { ImportValidationError } from './ImportValidationError';

const MAX_WARNINGS = 100;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface ThingsChecklistItem {
    title?: unknown;
    status?: unknown;
}
interface ThingsTodo {
    uuid?: unknown;
    type?: unknown;
    title?: unknown;
    subtitle?: unknown;
    notes?: unknown;
    status?: unknown;
    start?: unknown;
    start_date?: unknown;
    deadline?: unknown;
    reminder_time?: unknown;
    tags?: unknown;
    checklist?: unknown;
    items?: unknown;
    index?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class ThingsJsonImportAdapter implements ImportAdapter<ParsedTasks> {
    readonly format = 'things-json';

    import(source: string): ParsedTasks {
        let parsed: unknown;
        try {
            parsed = JSON.parse(source);
        } catch {
            throw new ImportValidationError('Not a valid JSON document');
        }
        if (!Array.isArray(parsed)) {
            throw new ImportValidationError(
                'Not a Things 3 JSON export: expected a top-level array of to-dos',
            );
        }

        const tasks: ImportedTask[] = [];
        const warnings: ImportIssue[] = [];
        const warn = (source: number, message: string): void => {
            if (warnings.length < MAX_WARNINGS) warnings.push({ source, message });
        };

        for (const [index, entry] of parsed.entries()) {
            const source = index + 1;
            if (!isRecord(entry)) {
                warn(source, 'non-object entry skipped');
                continue;
            }
            const todo = entry as ThingsTodo;
            const type = typeof todo.type === 'string' ? todo.type : 'to-do';
            const title = typeof todo.title === 'string' ? todo.title.trim() : '';
            const status = typeof todo.status === 'string' ? todo.status : 'incomplete';

            if (type === 'project' || type === 'heading') {
                warn(source, `${type} "${title}" skipped (only to-dos import)`);
                continue;
            }
            if (type !== 'to-do') {
                warn(source, `unknown type "${type}" skipped`);
                continue;
            }
            if (title === '') {
                warn(source, 'to-do without a title skipped');
                continue;
            }
            if (title.length > TASK_CONSTRAINTS.MAX_TEXT_LENGTH) {
                warn(
                    source,
                    `title longer than ${TASK_CONSTRAINTS.MAX_TEXT_LENGTH} characters skipped`,
                );
                continue;
            }

            let date: string | null = null;
            if (typeof todo.start_date === 'string' && ISO_DATE.test(todo.start_date)) {
                date = todo.start_date;
            } else if (todo.start_date !== undefined && todo.start_date !== null) {
                warn(
                    source,
                    `start_date "${String(todo.start_date)}" is not a yyyy-MM-dd date; imported undated`,
                );
            }

            let startTime: string | null = null;
            if (todo.reminder_time !== undefined && todo.reminder_time !== null) {
                if (
                    typeof todo.reminder_time === 'string' &&
                    /^\d{2}:\d{2}$/.test(todo.reminder_time)
                ) {
                    startTime = todo.reminder_time;
                } else {
                    warn(
                        source,
                        `reminder_time "${String(todo.reminder_time)}" is not an HH:MM time; ignored`,
                    );
                }
            }

            const tags = Array.isArray(todo.tags)
                ? todo.tags.filter((tag): tag is string => typeof tag === 'string')
                : [];
            if (Array.isArray(todo.tags) && todo.tags.some(tag => typeof tag !== 'string')) {
                warn(source, 'some tags were not strings; ignored');
            }

            let notes = typeof todo.notes === 'string' ? todo.notes.trim() : '';
            if (typeof todo.subtitle === 'string' && todo.subtitle.trim() !== '') {
                notes = notes === '' ? todo.subtitle.trim() : `${todo.subtitle.trim()}\n${notes}`;
            }
            if (typeof todo.deadline === 'string' && ISO_DATE.test(todo.deadline)) {
                notes = `${notes}\nDeadline: ${todo.deadline}`.trim();
            }

            const subtasks: ImportedTask[] = [];
            if (Array.isArray(todo.checklist)) {
                for (const raw of todo.checklist) {
                    if (!isRecord(raw)) continue;
                    const item = raw as ThingsChecklistItem;
                    const itemTitle = typeof item.title === 'string' ? item.title.trim() : '';
                    if (itemTitle === '') continue;
                    const itemStatus = typeof item.status === 'string' ? item.status : 'incomplete';
                    subtasks.push({
                        text: itemTitle,
                        notes: null,
                        date: null, // checklist items have no own schedule
                        startTime: null,
                        endTime: null,
                        tags: [],
                        completed: itemStatus === 'completed',
                        canceled: itemStatus === 'canceled',
                        subtasks: [],
                    });
                }
            }

            tasks.push({
                text: title,
                notes: notes === '' ? null : notes,
                date,
                startTime,
                endTime: null,
                tags,
                completed: status === 'completed',
                canceled: status === 'canceled',
                subtasks,
            });
        }

        return { tasks, warnings };
    }
}
