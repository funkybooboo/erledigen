/**
 * Natural-language recurrence parsing
 *
 * Detects a trailing recurrence phrase in task text, TeuxDeux-style:
 * typing "Meditate every day at 4:00pm" at the inline add box creates a
 * recurring task ("habit") named "Meditate" instead of a one-off task.
 *
 * The phrase must appear at the END of the text, so "Buy milk daily"
 * recurs but "Daily standup notes" does not.
 *
 * Supported forms (case-insensitive):
 *   every day / everyday / daily
 *   every other day / every N days
 *   every week / weekly / weekly on friday
 *   every N weeks (on friday)
 *   every month / monthly / monthly on the 15th / every month on the 15th
 *   every N months (on the Nth)
 *   every year / yearly / annually / every N years
 *   every friday / every fridays (full names or 3-letter abbreviations)
 * plus an optional time suffix:
 *   at 4:00pm / at 4pm / at 16:00 / at noon / at midnight
 *
 * Pure functions, no I/O — fully unit testable.
 */

import { WEEKDAY_ABBREVIATIONS, WEEKDAY_NAMES } from '../constants';
import type { RecurringFrequency } from '../types/recurringTask';

export interface RecurrenceSchedule {
    frequency: RecurringFrequency;
    /** 1 = every period, 2 = every other, 3 = every third, ... */
    interval: number;
    /** 0-6 for weekly recurrence (0 = Sunday), null when not weekly-on-a-day */
    dayOfWeek: number | null;
    /** 1-31 for monthly recurrence, null when not monthly-on-a-day */
    dayOfMonth: number | null;
    /** 24h "HH:MM" stamped onto instances, null when no time given */
    startTime: string | null;
}

export interface ParsedRecurrence {
    /** Task text with the recurrence phrase stripped, trimmed. */
    cleanText: string;
    /** The matched phrase, e.g. "every day at 4:00pm" (for UI hints). */
    phrase: string;
    schedule: RecurrenceSchedule;
}

const WEEKDAY_LOOKUP: Record<string, number> = {};
WEEKDAY_NAMES.forEach((name, i) => {
    WEEKDAY_LOOKUP[name.toLowerCase()] = i;
});
WEEKDAY_ABBREVIATIONS.forEach((abbr, i) => {
    WEEKDAY_LOOKUP[abbr.toLowerCase()] = i;
});

const MAX_INTERVAL = 365;

// Full names before abbreviations so "sunday" is preferred over "sun".
const WEEKDAY_WORDS = [...WEEKDAY_NAMES, ...WEEKDAY_ABBREVIATIONS].map(w => w.toLowerCase());

// A trailing "at <time>". Two clock forms:
//   H:MM with optional am/pm ("4:00pm", "16:00") and bare H with required
//   am/pm ("4pm"). noon/midnight are spelled out. Groups:
//   1=whole time, 2/3/4 = H:MM + optional meridiem, 5/6 = H + meridiem.
const TIME_AT_END_RE =
    /\s+at\s+(noon|midnight|(\d{1,2}):(\d{2})(?:\s*(am|pm))?|(\d{1,2})\s*(am|pm))\s*$/i;

/** Trailing "at ..." time converted to 24h "HH:MM"; null when absent, undefined when invalid. */
function parseTrailingTime(text: string): { rest: string; startTime: string | null } | undefined {
    const m = TIME_AT_END_RE.exec(text);
    if (!m) return { rest: text, startTime: null };

    const startTime = toStartTime(m);
    if (startTime === undefined) return undefined; // e.g. "at 13pm"
    return { rest: text.slice(0, m.index), startTime };
}

function toStartTime(m: RegExpExecArray): string | undefined {
    if (m[1] === 'noon') return '12:00';
    if (m[1] === 'midnight') return '00:00';

    let hours: number;
    let minutes: number;
    let meridiem: string | undefined;

    const rawH = m[2];
    if (rawH !== undefined) {
        hours = Number.parseInt(rawH, 10);
        minutes = m[3] === undefined ? 0 : Number.parseInt(m[3], 10);
        meridiem = m[4]?.toLowerCase();
    } else {
        hours = m[5] === undefined ? Number.NaN : Number.parseInt(m[5], 10);
        minutes = 0;
        meridiem = m[6]?.toLowerCase();
    }

    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return undefined;
    if (meridiem) {
        if (hours < 1 || hours > 12) return undefined;
        let h = hours % 12;
        if (meridiem === 'pm') h += 12;
        return `${String(h).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    if (hours < 0 || hours > 23) return undefined;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * A candidate phrase pattern: matches a phrase at the very end of the
 * (time-stripped) text. `(?:^|\\s)` keeps the phrase word-aligned; the
 * builders turn capture groups into a schedule.
 */
interface Candidate {
    re: RegExp;
    build: (m: RegExpExecArray) => RecurrenceSchedule | null;
}

const base = (): RecurrenceSchedule => ({
    frequency: 'daily',
    interval: 1,
    dayOfWeek: null,
    dayOfMonth: null,
    startTime: null,
});

const intervalOf = (raw: string | undefined): number | null => {
    if (raw === undefined) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isInteger(n) && n >= 1 && n <= MAX_INTERVAL ? n : null;
};

const dayOfMonthOf = (raw: string | undefined): number | null => {
    if (raw === undefined) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
};

const weekdayOf = (word: string | undefined): number | null => {
    if (word === undefined) return null;
    const index = WEEKDAY_LOOKUP[word.toLowerCase()];
    return index === undefined ? null : index;
};

const dayWords = WEEKDAY_WORDS.join('|');

const CANDIDATES: Candidate[] = [
    {
        re: /(?:^|\s)every other day$/i,
        build: () => ({ ...base(), frequency: 'daily', interval: 2 }),
    },
    {
        re: /(?:^|\s)every (\d{1,3}) days?$/i,
        build: m => {
            const interval = intervalOf(m[1]);
            return interval === null ? null : { ...base(), frequency: 'daily', interval };
        },
    },
    {
        re: /(?:^|\s)(?:every day|everyday|daily)$/i,
        build: () => ({ ...base(), frequency: 'daily' }),
    },
    {
        re: new RegExp(`(?:^|\\s)every (\\d{1,3}) weeks? on (${dayWords})$`, 'i'),
        build: m => {
            const interval = intervalOf(m[1]);
            const day = weekdayOf(m[2]);
            return interval === null || day === null
                ? null
                : { ...base(), frequency: 'weekly', interval, dayOfWeek: day };
        },
    },
    {
        re: /(?:^|\s)every (\d{1,3}) weeks?$/i,
        build: m => {
            const interval = intervalOf(m[1]);
            return interval === null ? null : { ...base(), frequency: 'weekly', interval };
        },
    },
    {
        re: new RegExp(`(?:^|\\s)(?:every week|weekly) on (${dayWords})$`, 'i'),
        build: m => {
            const day = weekdayOf(m[1]);
            return day === null ? null : { ...base(), frequency: 'weekly', dayOfWeek: day };
        },
    },
    {
        re: /(?:^|\s)(?:every week|weekly)$/i,
        build: () => ({ ...base(), frequency: 'weekly' }),
    },
    {
        re: /(?:^|\s)every (?:month on the|(\d{1,3}) months? on the) (\d{1,2})(?:st|nd|rd|th)?$/i,
        build: m => {
            const dom = dayOfMonthOf(m[2]);
            if (dom === null) return null;
            if (m[1]) {
                const interval = intervalOf(m[1]);
                return interval === null
                    ? null
                    : { ...base(), frequency: 'monthly', interval, dayOfMonth: dom };
            }
            return { ...base(), frequency: 'monthly', dayOfMonth: dom };
        },
    },
    {
        re: /(?:^|\s)every (\d{1,3}) months?$/i,
        build: m => {
            const interval = intervalOf(m[1]);
            return interval === null ? null : { ...base(), frequency: 'monthly', interval };
        },
    },
    {
        re: /(?:^|\s)monthly on (?:the (\d{1,2})(?:st|nd|rd|th)?|day (\d{1,2}))$/i,
        build: m => {
            const dom = dayOfMonthOf(m[1] ?? m[2]);
            return dom === null ? null : { ...base(), frequency: 'monthly', dayOfMonth: dom };
        },
    },
    {
        re: /(?:^|\s)(?:every month|monthly)$/i,
        build: () => ({ ...base(), frequency: 'monthly' }),
    },
    {
        re: /(?:^|\s)every (\d{1,3}) years?$/i,
        build: m => {
            const interval = intervalOf(m[1]);
            return interval === null ? null : { ...base(), frequency: 'yearly', interval };
        },
    },
    {
        re: /(?:^|\s)(?:every year|yearly|annually)$/i,
        build: () => ({ ...base(), frequency: 'yearly' }),
    },
    {
        re: new RegExp(`(?:^|\\s)every (${dayWords})s?$`, 'i'),
        build: m => {
            const day = weekdayOf(m[1]);
            return day === null ? null : { ...base(), frequency: 'weekly', dayOfWeek: day };
        },
    },
];

/**
 * Parse a trailing recurrence phrase out of task text.
 * Returns null when the text does not end with a recognized phrase,
 * or when the phrase is invalid (e.g. "on the 32nd"), or when nothing
 * would remain as the habit's text.
 */
export function parseRecurrence(text: string): ParsedRecurrence | null {
    const trimmed = text
        .trim()
        // Strip trailing sentence punctuation before matching.
        .replace(/[.!?]+$/, '')
        .trim();
    if (!trimmed) return null;

    // Peel off a trailing "at <time>" first, then match the frequency
    // phrase at the end of what remains.
    const time = parseTrailingTime(trimmed);
    if (!time) return null; // invalid time like "at 13pm"

    for (const candidate of CANDIDATES) {
        const m = candidate.re.exec(time.rest);
        if (!m) continue;

        const schedule = candidate.build(m);
        if (!schedule) return null; // matched but invalid (bad interval/day)

        // The match includes the whitespace before the phrase; everything
        // before it is the habit's text.
        const cleanText = time.rest
            .slice(0, m.index)
            .replace(/[,;\s]+$/, '')
            .trim();
        if (!cleanText) return null; // nothing left — not a usable habit

        // Phrase in the original text = the matched frequency part plus the
        // peeled-off " at <time>" tail. time.rest is a prefix of trimmed and
        // the match starts at the same index in both.
        const phrase = trimmed.slice(m.index).trim();
        schedule.startTime = time.startTime;

        return { cleanText, phrase, schedule };
    }

    return null;
}
