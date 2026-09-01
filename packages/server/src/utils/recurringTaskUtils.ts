/**
 * Recurring task utilities
 *
 * Pure functions for generating task occurrence dates from a RecurringTask template.
 * No I/O — fully unit testable.
 */

import type { RecurringTask } from '@erledigen/shared';

const MS_PER_DAY = 86_400_000;

/**
 * Generate occurrence dates for a recurring task within a date range (inclusive).
 *
 * A date is an occurrence when it is on the template's interval grid measured
 * from `startDate` AND matches the schedule's day constraints:
 *   - `daysOfWeek` (0-6, 0 = Sunday) filters daily/weekly schedules to the
 *     listed weekdays — null means any day.
 *   - `dayOfMonth` pins monthly schedules to that calendar day — null keeps
 *     the start date's day-of-month.
 *
 * @param rt - The recurring task template
 * @param startDate - Range start, ISO 8601 YYYY-MM-DD
 * @param endDate - Range end, ISO 8601 YYYY-MM-DD
 * @returns Array of ISO 8601 date strings for each occurrence
 */
export function generateOccurrences(
    rt: RecurringTask,
    startDate: string,
    endDate: string,
): string[] {
    // Parse YYYY-MM-DD as a local-midnight Date so local getters (getFullYear/
    // getMonth/getDate) return the same calendar day in every timezone. Using
    // `new Date('YYYY-MM-DD')` instead parses as UTC midnight, which shifts the
    // day back by one in negative-offset zones (the occurrence dates came back
    // a day early through the HTTP API when the server ran in UTC-6).
    const start = parseLocal(startDate);
    const end = parseLocal(endDate);
    const templateStart = parseLocal(rt.startDate);
    const templateEnd = rt.endDate ? parseLocal(rt.endDate) : null;

    // Clamp effective range to the template's own start/end dates
    const effectiveStart = start > templateStart ? start : templateStart;
    const effectiveEnd = templateEnd && end > templateEnd ? templateEnd : end;

    if (effectiveStart > effectiveEnd) return [];

    const results: string[] = [];
    const cursor = new Date(effectiveStart);

    while (cursor <= effectiveEnd) {
        if (isOccurrence(rt, cursor)) results.push(toIsoDate(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }

    return results;
}

/**
 * The next occurrence date strictly after `afterIso`, ignoring the template's
 * endDate. Used for streak math: two consecutive instances are "adjacent"
 * exactly when the later one equals nextOccurrenceIso(earlier one).
 *
 * Returns null when no occurrence exists within a generous horizon (malformed
 * schedules only; a sane template always finds its next occurrence).
 */
export function nextOccurrenceIso(rt: RecurringTask, afterIso: string): string | null {
    const cursor = parseLocal(afterIso);
    // Guard the walk so a malformed template can never spin forever.
    const limit = new Date(cursor);
    limit.setFullYear(limit.getFullYear() + 50);

    cursor.setDate(cursor.getDate() + 1);
    while (cursor <= limit) {
        if (isOccurrence(rt, cursor)) return toIsoDate(cursor);
        cursor.setDate(cursor.getDate() + 1);
    }
    return null;
}

/**
 * Whether a calendar date satisfies the template's schedule. The date is
 * assumed to be on or after the template's start date (callers clamp).
 */
function isOccurrence(rt: RecurringTask, date: Date): boolean {
    const interval = rt.interval > 0 ? rt.interval : 1;
    const start = parseLocal(rt.startDate);

    switch (rt.frequency) {
        case 'daily': {
            if (daysBetween(start, date) % interval !== 0) return false;
            return matchesDaysOfWeek(rt, date);
        }
        case 'weekly': {
            const days = rt.daysOfWeek;
            if (days && days.length > 0) {
                // Multi-day weekly schedules: listed weekdays, in every
                // interval-th week measured from the start date's week.
                if (!days.includes(date.getDay())) return false;
                const anchorWeek = weekStartOf(start);
                return daysBetween(anchorWeek, weekStartOf(date)) % (7 * interval) === 0;
            }
            return daysBetween(start, date) % (7 * interval) === 0;
        }
        case 'monthly': {
            const monthsBetween =
                (date.getFullYear() - start.getFullYear()) * 12 +
                (date.getMonth() - start.getMonth());
            if (monthsBetween % interval !== 0) return false;
            // Months without the requested day (e.g. Feb 31) simply have no
            // occurrence that month.
            const dom = rt.dayOfMonth ?? start.getDate();
            return date.getDate() === dom;
        }
        case 'yearly': {
            const years = date.getFullYear() - start.getFullYear();
            if (years % interval !== 0) return false;
            return date.getMonth() === start.getMonth() && date.getDate() === start.getDate();
        }
    }
}

/** True when the date's weekday is allowed by `daysOfWeek` (null = any day). */
function matchesDaysOfWeek(rt: RecurringTask, date: Date): boolean {
    const days = rt.daysOfWeek;
    if (!days || days.length === 0) return true;
    return days.includes(date.getDay());
}

/** Whole calendar days from a to b (DST-safe: compares UTC projections of
 *  the local calendar dates). */
function daysBetween(a: Date, b: Date): number {
    const aUtc = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const bUtc = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((bUtc - aUtc) / MS_PER_DAY);
}

/** The Sunday that starts the week containing `date`. */
function weekStartOf(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
}

/**
 * Parse a `YYYY-MM-DD` string as a Date at local midnight (not UTC midnight),
 * so local getters return the same calendar day regardless of zone.
 */
function parseLocal(iso: string): Date {
    const parts = iso.split('-').map(Number);
    const y = parts[0] ?? 1970;
    const m = parts[1] ?? 1;
    const d = parts[2] ?? 1;
    return new Date(y, m - 1, d);
}

/**
 * Format a Date as YYYY-MM-DD without timezone conversion.
 */
function toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
