import { WEEKDAY_ABBREVIATIONS, WEEKDAY_NAMES } from '../constants';
import type { RecurringTask } from '../types/recurringTask';
import type { RecurrenceSchedule } from './parseRecurrence';

const WEEKDAYS_SET = [1, 2, 3, 4, 5];
const WEEKEND_SET = [0, 6];

/** Compact label for a set of weekdays: "Weekdays", "Weekends",
 *  "Mon, Wed, Fri", or null when the set is empty/absent. */
function daysLabel(days: number[] | null | undefined): string | null {
    if (!days || days.length === 0) return null;
    if (days.length === WEEKDAYS_SET.length && WEEKDAYS_SET.every(d => days.includes(d))) {
        return 'Weekdays';
    }
    if (days.length === WEEKEND_SET.length && WEEKEND_SET.every(d => days.includes(d))) {
        return 'Weekends';
    }
    const names = [...days].sort((a, b) => a - b).map(d => WEEKDAY_ABBREVIATIONS[d] ?? 'day');
    return names.join(', ');
}

/** True when the schedule lands on exactly one weekday. */
function singleDay(days: number[] | null | undefined): number | null {
    if (days?.length !== 1) return null;
    return days[0] ?? null;
}

/**
 * Human-readable description of a recurring task's schedule,
 * e.g. "Every Friday at 4:00pm", "Every other day", "Monthly on day 15",
 * "Weekdays at 9:30am", "Every week on Mon, Wed, Fri".
 */
export function formatFrequency(task: RecurringTask): string {
    return describeRecurrence({
        frequency: task.frequency,
        interval: task.interval,
        daysOfWeek: task.daysOfWeek,
        dayOfMonth: task.dayOfMonth,
        startTime: task.startTime,
    });
}

/**
 * Describe a bare schedule (the same shape parseRecurrence returns),
 * without needing a full RecurringTask.
 */
export function describeRecurrence(schedule: RecurrenceSchedule): string {
    const { frequency, interval, daysOfWeek, dayOfMonth, startTime } = schedule;
    let text: string;

    if (frequency === 'daily') {
        const label = daysLabel(daysOfWeek);
        if (label && singleDay(daysOfWeek) === null) {
            // Multi-day daily schedules read naturally as their label:
            // "Weekdays", "Weekends", "Mon, Wed, Fri".
            text = interval === 1 ? label : `Every ${interval} days on ${label}`;
        } else if (singleDay(daysOfWeek) !== null) {
            const day = WEEKDAY_NAMES[singleDay(daysOfWeek) ?? 0] ?? 'day';
            text = interval === 1 ? `Every ${day}` : `Every ${interval} days on ${day}`;
        } else if (interval === 1) {
            text = 'Every day';
        } else if (interval === 2) {
            text = 'Every other day';
        } else {
            text = `Every ${interval} days`;
        }
    } else if (frequency === 'weekly') {
        const label = daysLabel(daysOfWeek);
        const single = singleDay(daysOfWeek);
        if (single !== null) {
            const day = WEEKDAY_NAMES[single] ?? 'day';
            text = interval === 1 ? `Every ${day}` : `Every ${interval} weeks on ${day}`;
        } else if (label) {
            text =
                interval === 1 ? `Every week on ${label}` : `Every ${interval} weeks on ${label}`;
        } else {
            text = interval === 1 ? 'Every week' : `Every ${interval} weeks`;
        }
    } else if (frequency === 'monthly') {
        const onDay =
            dayOfMonth !== null && dayOfMonth !== undefined ? ` on day ${dayOfMonth}` : '';
        text = interval === 1 ? `Monthly${onDay}` : `Every ${interval} months${onDay}`;
    } else {
        text = interval === 1 ? 'Every year' : `Every ${interval} years`;
    }

    if (startTime) text += ` at ${formatTime12(startTime)}`;
    return text;
}

/** Convert 24h "HH:MM" to a friendly "h:MMam/pm" label. */
export function formatTime12(hhmm: string): string {
    const parts = hhmm.split(':').map(Number);
    const h = parts[0];
    const m = parts[1];
    if (h === undefined || m === undefined || !Number.isInteger(h) || !Number.isInteger(m)) {
        return hhmm;
    }
    const meridiem = h < 12 ? 'am' : 'pm';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, '0')}${meridiem}`;
}
