/**
 * Recurring task utilities
 *
 * Pure functions for generating task occurrence dates from a RecurringTask
 * template. No I/O -- fully unit testable.
 *
 * All date math operates on `YYYY-MM-DD` keys via `utils/dateKeys` (pure
 * Gregorian `Date.UTC` arithmetic). Never parse keys with
 * `new Date('YYYY-MM-DD')` -- that is UTC midnight, which shifts the day
 * back by one in negative-offset zones (occurrence dates came back a day
 * early through the HTTP API when the server ran in UTC-6).
 */

import type { RecurringTask } from '../types/recurringTask';
import { addDays, daysBetween, splitKey, weekdayOf } from './dateKeys';

/**
 * Generate occurrence dates for a recurring task within a date range (inclusive).
 *
 * A date is an occurrence when it is on the template's interval grid measured
 * from `startDate` AND matches the schedule's day constraints:
 *   - `daysOfWeek` (0-6, 0 = Sunday) filters daily/weekly schedules to the
 *     listed weekdays -- null means any day.
 *   - `dayOfMonth` pins monthly schedules to that calendar day -- null keeps
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
    // Clamp effective range to the template's own start/end dates
    // (zero-padded ISO keys compare lexicographically = calendar order).
    const effectiveStart = startDate > rt.startDate ? startDate : rt.startDate;
    const effectiveEnd = rt.endDate && endDate > rt.endDate ? rt.endDate : endDate;

    if (effectiveStart > effectiveEnd) return [];

    const results: string[] = [];
    let cursor = effectiveStart;

    while (cursor <= effectiveEnd) {
        if (isOccurrence(rt, cursor)) results.push(cursor);
        cursor = addDays(cursor, 1);
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
    // Guard the walk so a malformed template can never spin forever.
    const limit = addDays(afterIso, 365 * 50);
    let cursor = addDays(afterIso, 1);

    while (cursor <= limit) {
        if (isOccurrence(rt, cursor)) return cursor;
        cursor = addDays(cursor, 1);
    }
    return null;
}

/**
 * Whether a calendar date satisfies the template's schedule.
 *
 * A date strictly before the template's start date is never an occurrence,
 * whatever the interval math says. This matters because callers do NOT
 * always clamp: `nextOccurrenceIso` walks from instance dates, and an
 * instance can predate the template after its startDate is edited forward
 * -- JS modulo on a negative day count (-3 % 3 === 0) would otherwise count
 * pre-start dates as on-grid and corrupt streak adjacency.
 */
function isOccurrence(rt: RecurringTask, dateKey: string): boolean {
    if (dateKey < rt.startDate) return false;
    const interval = rt.interval > 0 ? rt.interval : 1;
    const start = rt.startDate;

    switch (rt.frequency) {
        case 'daily': {
            if (daysBetween(start, dateKey) % interval !== 0) return false;
            return matchesDaysOfWeek(rt, dateKey);
        }
        case 'weekly': {
            const days = rt.daysOfWeek;
            if (days && days.length > 0) {
                // Multi-day weekly schedules: listed weekdays, in every
                // interval-th week measured from the start date's week.
                if (!days.includes(weekdayOf(dateKey))) return false;
                const anchorWeek = weekStartOf(start);
                return daysBetween(anchorWeek, weekStartOf(dateKey)) % (7 * interval) === 0;
            }
            return daysBetween(start, dateKey) % (7 * interval) === 0;
        }
        case 'monthly': {
            const [startY, startM] = splitKey(start);
            const [dateY, dateM, dateD] = splitKey(dateKey);
            const monthsBetween = (dateY - startY) * 12 + (dateM - startM);
            if (monthsBetween % interval !== 0) return false;
            // Months without the requested day (e.g. Feb 31) simply have no
            // occurrence that month.
            const dom = rt.dayOfMonth ?? splitKey(start)[2];
            return dateD === dom;
        }
        case 'yearly': {
            const [startY, startM, startD] = splitKey(start);
            const [dateY, dateM, dateD] = splitKey(dateKey);
            if ((dateY - startY) % interval !== 0) return false;
            return dateM === startM && dateD === startD;
        }
    }
}

/** True when the date's weekday is allowed by `daysOfWeek` (null = any day). */
function matchesDaysOfWeek(rt: RecurringTask, dateKey: string): boolean {
    const days = rt.daysOfWeek;
    if (!days || days.length === 0) return true;
    return days.includes(weekdayOf(dateKey));
}

/** The Sunday that starts the week containing `dateKey`. */
function weekStartOf(dateKey: string): string {
    return addDays(dateKey, -weekdayOf(dateKey));
}
