import { WEEKDAY_ABBREVIATIONS, WEEKDAY_NAMES } from '../constants';
import type { RecurrenceSchedule } from './parseRecurrence';

const WEEKDAYS_SET = [1, 2, 3, 4, 5];
const WEEKEND_SET = [0, 6];

/**
 * The display phrases describeRecurrence builds sentences from (v0.13.0,
 * USE-14): one function per sentence shape. The English default below is
 * what the app shipped before i18n; the client passes a locale-backed
 * implementation (recurrencePhrases.ts) so the sentences localize without
 * the schedule logic leaving this package.
 *
 * The word order of each sentence is the template's own -- a locale can
 * reorder inside any one sentence, but the final " at <time>" clause
 * always composes after the schedule part (documented in
 * docs/build/standards/i18n.md).
 */
export interface RecurrencePhrases {
    /** Full weekday name for a 0=Sunday..6=Saturday index. */
    weekday(index: number): string;
    /** Short weekday abbreviation ('Mon'). */
    weekdayShort(index: number): string;
    /** The Mon-Fri set label. */
    weekdays: string;
    /** The Sat-Sun set label. */
    weekends: string;
    everyDay: string;
    everyOtherDay: string;
    everyNDays(interval: number): string;
    everyDayName(day: string): string;
    everyNDaysOnDayName(interval: number, day: string): string;
    everyNDaysOnDays(interval: number, days: string): string;
    everyWeek: string;
    everyNWeeks(interval: number): string;
    everyWeekOnDays(days: string): string;
    everyNWeeksOnDays(interval: number, days: string): string;
    everyNWeeksOnDayName(interval: number, day: string): string;
    monthly: string;
    monthlyOnDay(day: number): string;
    everyNMonths(interval: number): string;
    everyNMonthsOnDay(interval: number, day: number): string;
    everyYear: string;
    everyNYears(interval: number): string;
    /** The ' at <time>' suffix; the time label is already formatted. */
    atTime(time: string): string;
    /** Wall-clock label for a 24h 'HH:MM' string. */
    timeLabel(hhmm: string): string;
}

/** The English phrases (the pre-i18n shipped wording, unchanged). */
export const ENGLISH_RECURRENCE_PHRASES: RecurrencePhrases = {
    weekday: index => WEEKDAY_NAMES[index] ?? 'day',
    weekdayShort: index => WEEKDAY_ABBREVIATIONS[index] ?? 'day',
    weekdays: 'Weekdays',
    weekends: 'Weekends',
    everyDay: 'Every day',
    everyOtherDay: 'Every other day',
    everyNDays: interval => `Every ${interval} days`,
    everyDayName: day => `Every ${day}`,
    everyNDaysOnDayName: (interval, day) => `Every ${interval} days on ${day}`,
    everyNDaysOnDays: (interval, days) => `Every ${interval} days on ${days}`,
    everyWeek: 'Every week',
    everyNWeeks: interval => `Every ${interval} weeks`,
    everyWeekOnDays: days => `Every week on ${days}`,
    everyNWeeksOnDays: (interval, days) => `Every ${interval} weeks on ${days}`,
    everyNWeeksOnDayName: (interval, day) => `Every ${interval} weeks on ${day}`,
    monthly: 'Monthly',
    monthlyOnDay: day => `Monthly on day ${day}`,
    everyNMonths: interval => `Every ${interval} months`,
    everyNMonthsOnDay: (interval, day) => `Every ${interval} months on day ${day}`,
    everyYear: 'Every year',
    everyNYears: interval => `Every ${interval} years`,
    atTime: time => ` at ${time}`,
    timeLabel: hhmm => formatTime12(hhmm),
};

/** Compact label for a set of weekdays: the Weekdays/Weekends set
 *  labels, the short weekday list ('Mon, Wed, Fri'), or null when the
 *  set is empty/absent. */
function daysLabel(days: number[] | null | undefined, phrases: RecurrencePhrases): string | null {
    if (!days || days.length === 0) return null;
    if (days.length === WEEKDAYS_SET.length && WEEKDAYS_SET.every(d => days.includes(d))) {
        return phrases.weekdays;
    }
    if (days.length === WEEKEND_SET.length && WEEKEND_SET.every(d => days.includes(d))) {
        return phrases.weekends;
    }
    const names = [...days].sort((a, b) => a - b).map(d => phrases.weekdayShort(d));
    return names.join(', ');
}

/** True when the schedule lands on exactly one weekday. */
function singleDay(days: number[] | null | undefined): number | null {
    if (days?.length !== 1) return null;
    return days[0] ?? null;
}

/**
 * Describe a bare schedule (the same shape parseRecurrence returns),
 * without needing a full RecurringTask. The sentences come from
 * `phrases` (English by default; the client passes its locale's).
 */
export function describeRecurrence(
    schedule: RecurrenceSchedule,
    phrases: RecurrencePhrases = ENGLISH_RECURRENCE_PHRASES,
): string {
    const { frequency, interval, daysOfWeek, dayOfMonth, startTime } = schedule;
    let text: string;

    if (frequency === 'daily') {
        const label = daysLabel(daysOfWeek, phrases);
        const single = singleDay(daysOfWeek);
        if (label && single === null) {
            // Multi-day daily schedules read naturally as their label:
            // "Weekdays", "Weekends", "Mon, Wed, Fri".
            text = interval === 1 ? label : phrases.everyNDaysOnDays(interval, label);
        } else if (single !== null) {
            const day = phrases.weekday(single);
            text =
                interval === 1
                    ? phrases.everyDayName(day)
                    : phrases.everyNDaysOnDayName(interval, day);
        } else if (interval === 1) {
            text = phrases.everyDay;
        } else if (interval === 2) {
            text = phrases.everyOtherDay;
        } else {
            text = phrases.everyNDays(interval);
        }
    } else if (frequency === 'weekly') {
        const label = daysLabel(daysOfWeek, phrases);
        const single = singleDay(daysOfWeek);
        if (single !== null) {
            const day = phrases.weekday(single);
            text =
                interval === 1
                    ? phrases.everyDayName(day)
                    : phrases.everyNWeeksOnDayName(interval, day);
        } else if (label) {
            text =
                interval === 1
                    ? phrases.everyWeekOnDays(label)
                    : phrases.everyNWeeksOnDays(interval, label);
        } else {
            text = interval === 1 ? phrases.everyWeek : phrases.everyNWeeks(interval);
        }
    } else if (frequency === 'monthly') {
        text =
            dayOfMonth !== null && dayOfMonth !== undefined
                ? interval === 1
                    ? phrases.monthlyOnDay(dayOfMonth)
                    : phrases.everyNMonthsOnDay(interval, dayOfMonth)
                : interval === 1
                  ? phrases.monthly
                  : phrases.everyNMonths(interval);
    } else {
        text = interval === 1 ? phrases.everyYear : phrases.everyNYears(interval);
    }

    if (startTime) text += phrases.atTime(phrases.timeLabel(startTime));
    return text;
}

/** Convert 24h "HH:MM" to a friendly "h:MMam/pm" label (the English
 *  shipped wording; a locale's timeLabel replaces it). */
function formatTime12(hhmm: string): string {
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
