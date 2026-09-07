/**
 * IcalExportAdapter -- RFC 5545 (iCalendar) export for calendar tools.
 *
 * Every ACTIVE task with a date becomes a VEVENT:
 * - all-day task (no startTime) -> date-valued DTSTART;VALUE=DATE
 * - timed task -> floating DATE-TIME values (Erledigen stores wall-clock
 *   times without a zone; importing apps read floating times as local)
 * - DTEND only when an endTime exists (otherwise a zero-length event)
 *
 * Notes become DESCRIPTION, tags become CATEGORIES. Someday and trashed
 * tasks have no calendar date and are excluded. A view, not a backup --
 * the JSON export is the lossless format (ADR-008).
 */

import type { ExportSnapshot } from '../../types/export';
import { EXPORT_FORMAT_META } from '../../types/export';
import type { Task } from '../../types/task';
import type { ExportAdapter } from './ExportAdapter';

const PRODID = '-//Erledigen//Erledigen Export//EN';
const UTF8 = new TextEncoder();

/** Escape text values per RFC 5545 section 3.3.11. */
function escapeText(value: string): string {
    // Regex replaces, not replaceAll: the server package's TS lib target
    // predates es2021's replaceAll.
    return value
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r\n|\r|\n/g, '\\n');
}

/** '2026-01-15' -> '20260115'. */
function icsDate(date: string): string {
    return date.replace(/-/g, '');
}

/** '09:00' -> '090000'. */
function icsTime(time: string): string {
    return `${time.replace(/:/g, '')}00`;
}

/** ISO timestamp -> UTC 'YYYYMMDDTHHMMSSZ' (RFC 5545 DATE-TIME, UTC form). */
function icsUtcTimestamp(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid timestamp for iCal export: ${iso}`);
    }
    // toISOString is always UTC 'YYYY-MM-DDTHH:mm:ss.sssZ'; keep the
    // seconds precision the format defines.
    return `${date.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
}

/**
 * Fold a content line to <= 75 octets per physical line (RFC 5545
 * section 3.1), inserting CRLF + a single space before continuation
 * lines. Splits on code points so multi-byte characters stay intact.
 */
function foldLine(line: string): string {
    const parts: string[] = [];
    let current = '';
    let currentBytes = 0;
    for (const char of line) {
        const charBytes = UTF8.encode(char).length;
        if (currentBytes + charBytes > 75) {
            parts.push(current);
            // Continuation lines include their leading space in the budget.
            current = ` ${char}`;
            currentBytes = 1 + charBytes;
        } else {
            current += char;
            currentBytes += charBytes;
        }
    }
    parts.push(current);
    return parts.join('\r\n');
}

function eventLines(task: Task): string[] {
    const lines: string[] = ['BEGIN:VEVENT', `UID:${task.id}@erledigen`];
    lines.push(`DTSTAMP:${icsUtcTimestamp(task.updatedAt)}`);
    if (task.startTime === null) {
        // All-day: a task without a start time (an endTime alone has no
        // calendar meaning -- endTime >= startTime is the model's rule).
        lines.push(`DTSTART;VALUE=DATE:${icsDate(task.date ?? '')}`);
    } else {
        const date = icsDate(task.date ?? '');
        lines.push(`DTSTART:${date}T${icsTime(task.startTime)}`);
        if (task.endTime !== null) {
            lines.push(`DTEND:${date}T${icsTime(task.endTime)}`);
        }
    }
    lines.push(`SUMMARY:${escapeText(task.text)}`);
    if (task.notes !== null) {
        lines.push(`DESCRIPTION:${escapeText(task.notes)}`);
    }
    if (task.tags.length > 0) {
        lines.push(`CATEGORIES:${task.tags.map(escapeText).join(',')}`);
    }
    lines.push('END:VEVENT');
    return lines;
}

export class IcalExportAdapter implements ExportAdapter {
    readonly extension = EXPORT_FORMAT_META.ics.extension;
    readonly contentType = EXPORT_FORMAT_META.ics.contentType;

    export(snapshot: ExportSnapshot): string {
        const contentLines = [
            'BEGIN:VCALENDAR',
            `PRODID:${PRODID}`,
            'VERSION:2.0',
            'CALSCALE:GREGORIAN',
            ...snapshot.tasks
                .filter(t => t.deletedAt === null && t.date !== null)
                .flatMap(eventLines),
            'END:VCALENDAR',
        ];
        return `${contentLines.map(foldLine).join('\r\n')}\r\n`;
    }
}
