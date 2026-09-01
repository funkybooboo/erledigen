import { WEEKDAY_NAMES } from '../constants';
import type { RecurringTask } from '../types/recurringTask';
import type { RecurrenceSchedule } from './parseRecurrence';

/**
 * Human-readable description of a recurring task's schedule,
 * e.g. "Every Friday at 4:00pm", "Every other day", "Monthly on day 15".
 */
export function formatFrequency(task: RecurringTask): string {
    return describeRecurrence({
        frequency: task.frequency,
        interval: task.interval,
        dayOfWeek: task.dayOfWeek,
        dayOfMonth: task.dayOfMonth,
        startTime: task.startTime,
    });
}

/**
 * Describe a bare schedule (the same shape parseRecurrence returns),
 * without needing a full RecurringTask.
 */
export function describeRecurrence(schedule: RecurrenceSchedule): string {
    const { frequency, interval, dayOfWeek, dayOfMonth, startTime } = schedule;
    let text: string;

    if (frequency === 'daily') {
        if (interval === 1) text = 'Every day';
        else if (interval === 2) text = 'Every other day';
        else text = `Every ${interval} days`;
    } else if (frequency === 'weekly') {
        if (dayOfWeek !== null && dayOfWeek !== undefined) {
            const day = WEEKDAY_NAMES[dayOfWeek] ?? 'day';
            text = interval === 1 ? `Every ${day}` : `Every ${interval} weeks on ${day}`;
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
