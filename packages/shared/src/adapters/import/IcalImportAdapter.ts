/**
 * IcalImportAdapter -- RFC 5545 .ics VEVENT entries as tasks (ADR-009).
 *
 * Additive source: every VEVENT becomes a NEW task; existing data is
 * never touched. Works with Google Calendar, Apple Calendar, and Outlook
 * exports. All-day events (VALUE=DATE) import date-only; timed events
 * import the local wall-clock date and time (floating, or converted
 * from UTC/TZID to the runtime zone -- the server is the writer, so its
 * effective timezone governs). Recurring events (RRULE) import only
 * their first occurrence, with a warning. Non-VEVENT components
 * (VTODO, VJOURNAL, ...) are skipped with a warning.
 */

import { TASK_CONSTRAINTS } from '../../constants';
import type { ImportedTask, ImportIssue, ParsedTasks } from '../../types/import';
import type { ImportAdapter } from './ImportAdapter';
import { ImportValidationError } from './ImportValidationError';

const MAX_WARNINGS = 100;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A parsed iCal content line (folded continuations already joined). */
interface ContentLine {
    name: string;
    params: Record<string, string[]>;
    value: string;
}

/** Unfold continuation lines (RFC 5545 3.1): a CRLF followed by a space
 *  or tab continues the previous line. Accepts LF endings too. */
function unfold(text: string): string[] {
    const lines: string[] = [];
    for (const rawLine of text.split(/\r?\n/)) {
        if ((rawLine.startsWith(' ') || rawLine.startsWith('\t')) && lines.length > 0) {
            lines[lines.length - 1] += rawLine.slice(1);
        } else if (rawLine !== '') {
            lines.push(rawLine);
        }
    }
    return lines;
}

function parseContentLine(line: string): ContentLine | null {
    const colon = line.indexOf(':');
    if (colon === -1) return null;
    const head = line.slice(0, colon);
    const value = line.slice(colon + 1);
    const params: Record<string, string[]> = {};
    // Head is NAME(;PARAM=VALUE)* -- quoted param values may contain
    // colons/semicolons; split respecting quotes.
    const segments: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of head) {
        if (char === '"') inQuotes = !inQuotes;
        if (char === ';' && !inQuotes) {
            segments.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    segments.push(current);
    const name = segments[0]?.toUpperCase() ?? '';
    for (const segment of segments.slice(1)) {
        const eq = segment.indexOf('=');
        if (eq === -1) continue;
        params[segment.slice(0, eq).toUpperCase()] = segment
            .slice(eq + 1)
            .replace(/^"|"$/g, '')
            .split(',')
            .map(v => v.trim());
    }
    return { name, params, value };
}

/** A DATE or DATE-TIME value in local wall-clock terms. */
interface IcalWhen {
    date: string;
    time: string | null;
}

function toDateOnly(compact: string): string | null {
    const match = /^(\d{4})(\d{2})(\d{2})$/.exec(compact);
    if (match === null) return null;
    const date = `${match[1]}-${match[2]}-${match[3]}`;
    // Reject month 13 etc. -- a "parsed" 2026-13-01 is corrupt source data.
    return ISO_DATE.test(date) ? date : null;
}

function toDateHourMinute(compact: string): [string, string] | null {
    const match = /^(\d{2})(\d{2})(\d{2})$/.exec(compact);
    if (match === null) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return null;
    const hh = match[1];
    const mm = match[2];
    if (hh === undefined || mm === undefined) return null;
    return [`${hh}:${mm}`, match[3] ?? '00'];
}

/** Zone offset (ms east of UTC) of `instant` in `timeZone`. */
function zoneOffsetMs(instant: number, timeZone: string): number {
    const format = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    const parts: Record<string, string> = {};
    for (const part of format.formatToParts(new Date(instant))) {
        parts[part.type] = part.value;
    }
    const year = Number(parts['year']);
    const month = Number(parts['month']) - 1;
    const day = Number(parts['day']);
    const hour = parts['hour'] === '24' ? 0 : Number(parts['hour']);
    const minute = Number(parts['minute']);
    const second = Number(parts['second'] ?? '0');
    return Date.UTC(year, month, day, hour, minute, second) - instant;
}

/** UTC instant of the wall time `compactDate compactTime` in `timeZone`.
 *  Offset iteration: guess UTC, measure the zone's offset at the
 *  guess, shift the guess; converges for stable zone rules. */
function zonedWallTimeToInstant(
    compactDate: string,
    compactTime: string,
    timeZone: string,
): number | null {
    const date = toDateOnly(compactDate);
    const hm = toDateHourMinute(compactTime);
    if (date === null || hm === null) return null;
    const wall = Date.parse(`${date}T${hm[0]}:${hm[1]}Z`);
    if (Number.isNaN(wall)) return null;
    let instant = wall;
    for (let round = 0; round < 3; round++) {
        const offset = zoneOffsetMs(instant, timeZone);
        const next = wall - offset;
        if (next === instant) break;
        instant = next;
    }
    return instant;
}

/** Format a UTC instant as the local wall-clock of `timeZone` (null =
 *  runtime default). */
function instantToLocalWallClock(instant: number, timeZone: string | null): IcalWhen | null {
    const format = new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone ?? undefined,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    const parts: Record<string, string> = {};
    for (const part of format.formatToParts(new Date(instant))) {
        parts[part.type] = part.value;
    }
    const year = parts['year'];
    const month = parts['month'];
    const day = parts['day'];
    const hour = parts['hour'] === '24' ? '00' : parts['hour'];
    const minute = parts['minute'];
    if (year === undefined || month === undefined || day === undefined) return null;
    if (hour === undefined || minute === undefined) return null;
    return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}

/** Convert a UTC (Z-suffixed) or TZID-zoned DATE-TIME to the local
 *  wall clock of the runtime zone. `timeZone` is the SOURCE zone; null
 *  means the value already is UTC. */
function toLocalWallClock(
    compactDate: string,
    compactTime: string,
    timeZone: string | null,
): IcalWhen | null {
    const instant =
        timeZone === null
            ? zonedWallTimeToInstant(compactDate, compactTime, 'UTC')
            : zonedWallTimeToInstant(compactDate, compactTime, timeZone);
    if (instant === null || Number.isNaN(instant)) return null;
    return instantToLocalWallClock(instant, null);
}

/** Parse a DTSTART/DTEND property value into local wall-clock terms. */
function parseWhen(prop: ContentLine | null): IcalWhen | null {
    if (prop === null) return null;
    const params = prop.params;
    if (params['VALUE']?.includes('DATE')) {
        const date = toDateOnly(prop.value.trim());
        return date === null ? null : { date, time: null };
    }
    const dateTime = prop.value.trim();
    const match = /^(\d{8})T(\d{6})(Z?)$/.exec(dateTime);
    if (match === null) {
        // Some producers emit DATE values without VALUE=DATE param.
        const date = toDateOnly(dateTime);
        return date === null ? null : { date, time: null };
    }
    const [, compactDate, compactTime, utcMark] = match;
    if (compactDate === undefined || compactTime === undefined) return null;
    if (utcMark === 'Z') {
        return toLocalWallClock(compactDate, compactTime, null);
    }
    if (params['TZID'] !== undefined) {
        return toLocalWallClock(compactDate, compactTime, params['TZID'][0] ?? null);
    }
    // Floating time: local as-is (matches the export side's convention).
    const date = toDateOnly(compactDate);
    const hm = toDateHourMinute(compactTime);
    if (date === null || hm === null) return null;
    return { date, time: hm[0] };
}

function unescapeText(value: string): string {
    // RFC 5545 3.3.11 text escapes.
    return value
        .replace(/\\n/g, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');
}

export class IcalImportAdapter implements ImportAdapter<ParsedTasks> {
    readonly format = 'ics';

    import(source: string): ParsedTasks {
        const lines = unfold(source);
        if (lines.length === 0) {
            throw new ImportValidationError('Empty iCal document');
        }
        if (!lines.some(line => line.toUpperCase().startsWith('BEGIN:VCALENDAR'))) {
            throw new ImportValidationError('Not an iCal document (no BEGIN:VCALENDAR)');
        }

        const tasks: ImportedTask[] = [];
        const warnings: ImportIssue[] = [];
        const warn = (message: string): void => {
            if (warnings.length < MAX_WARNINGS) warnings.push({ message });
        };

        let depth = 0;
        let inEvent = false;
        const current = new Map<string, ContentLine[]>();
        let skippedComponents = 0;

        /** Last occurrence of a property inside the current VEVENT
         *  (repeat lines: the last wins, matching producers that split
         *  e.g. long DESCRIPTIONs into repeated properties). */
        const last = (name: string): ContentLine | null => {
            const lines = current.get(name);
            return lines === undefined ? null : (lines[lines.length - 1] ?? null);
        };

        const flushEvent = (): void => {
            const summaryLine = last('SUMMARY');
            const summary = summaryLine?.value.trim() ?? '';
            const description = last('DESCRIPTION');
            const start = parseWhen(last('DTSTART'));
            const end = parseWhen(last('DTEND'));
            const status = last('STATUS')?.value.trim().toUpperCase() ?? '';
            const categories = last('CATEGORIES')?.value ?? '';
            const rrule = last('RRULE');

            if (summary === '') {
                warn('VEVENT without a SUMMARY skipped');
            } else if (summary.length > TASK_CONSTRAINTS.MAX_TEXT_LENGTH) {
                warn(
                    `VEVENT SUMMARY longer than ${TASK_CONSTRAINTS.MAX_TEXT_LENGTH} characters skipped`,
                );
            } else if (status === 'CANCELLED') {
                warn(`canceled event "${summary}" skipped`);
            } else if (start === null) {
                warn(`VEVENT "${summary}" without a parseable DTSTART skipped`);
            } else {
                let startTime: string | null = null;
                let endTime: string | null = null;
                if (end !== null) {
                    if (end.date === start.date) {
                        endTime = end.time;
                    } else if (start.time !== null || end.time !== null) {
                        warn(`multi-day event "${summary}" imported without an end time`);
                    }
                }
                if (start.time !== null) startTime = start.time;
                if (rrule !== null) {
                    warn(`recurring event "${summary}" imported as its first occurrence only`);
                }
                tasks.push({
                    text: summary,
                    notes: description ? unescapeText(description.value) : null,
                    date: start.date,
                    startTime,
                    endTime,
                    tags: categories
                        .split(',')
                        .map(tag => unescapeText(tag.trim()))
                        .filter(tag => tag !== ''),
                    completed: false, // A calendar event carries no done state.
                    canceled: false,
                    subtasks: [],
                });
            }
            current.clear();
        };

        for (const line of lines) {
            const parsed = parseContentLine(line);
            if (parsed === null) continue;
            const { name, value } = parsed;
            const upper = value.trim().toUpperCase();

            if (name === 'BEGIN') {
                depth++;
                if (upper === 'VEVENT') {
                    inEvent = true;
                    current.clear();
                }
                continue;
            }
            if (name === 'END') {
                if (upper === 'VEVENT' && inEvent) {
                    inEvent = false;
                    flushEvent();
                } else if (upper === 'VTODO' || upper === 'VJOURNAL') {
                    skippedComponents++;
                }
                depth = Math.max(0, depth - 1);
                continue;
            }
            if (inEvent) {
                const bucket = current.get(name) ?? [];
                bucket.push(parsed);
                current.set(name, bucket);
            }
        }

        if (skippedComponents > 0) {
            warn(
                `${skippedComponents} VTODO/VJOURNAL component(s) skipped ` +
                    '(only VEVENT entries import as tasks)',
            );
        }
        return { tasks, warnings };
    }
}
