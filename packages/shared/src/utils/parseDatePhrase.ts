/**
 * Natural-language parsing for a single calendar date.
 *
 * Two entry points over the same phrase table:
 *
 *   - `resolveDatePhrase(input, today)`: the WHOLE input must be one
 *     date phrase. Used where the user types only a date (the inline
 *     reschedule editor, the palette's `/go` command).
 *
 *   - `extractDatePhrase(text, today)`: scans free text (task-creation
 *     input like "buy milk tomorrow #work #p1"), strips the first
 *     phrase it finds, and returns it with the remaining text.
 *
 * Supported phrases (case-insensitive):
 *   today / tomorrow / yesterday
 *   in N days / in N weeks
 *   next <weekday>  (the next occurrence strictly after today)
 *   <weekday>       (same rule; "monday" on a Monday = next week)
 *   <month> <day>   (march 15, oct 15th; rolls to next year if passed)
 *   YYYY-MM-DD      (a literal date key)
 *
 * Pure functions over date keys -- no Date-object arithmetic, no I/O
 * (see dateKeys.ts for the timezone rationale). The caller supplies
 * `today` so the module stays unit-testable and zone-agnostic.
 */

import {
    MONTH_ABBREVIATIONS,
    MONTH_NAMES,
    WEEKDAY_ABBREVIATIONS,
    WEEKDAY_NAMES,
} from '../constants';
import { addDays, daysBetween, splitKey, weekdayOf } from './dateKeys';

export interface ParsedDatePhrase {
    /** Resolved local date key (YYYY-MM-DD). */
    date: string;
    /** The matched phrase, verbatim (e.g. "next monday"). */
    phrase: string;
    /** The input with the matched phrase removed, whitespace normalized. */
    rest: string;
}

/** Full names before abbreviations so "sunday" beats "sun" in alternations. */
const WEEKDAY_WORDS = [...WEEKDAY_NAMES, ...WEEKDAY_ABBREVIATIONS].map(w => w.toLowerCase());
const MONTH_WORDS = [...MONTH_NAMES, ...MONTH_ABBREVIATIONS].map(w => w.toLowerCase());
const WEEKDAY_ALT = WEEKDAY_WORDS.join('|');
const MONTH_ALT = MONTH_WORDS.join('|');

const MAX_RELATIVE_DAYS = 365;
const MAX_RELATIVE_WEEKS = 52;
const MAX_DAY_OF_MONTH = 31;

/** Validate a [y, m(0-based), d] triple as a real calendar date
 *  (rejects April 31, February 30, ...). */
function isValidDateKey(y: number, m: number, d: number): boolean {
    const utc = new Date(Date.UTC(y, m, d));
    return utc.getUTCFullYear() === y && utc.getUTCMonth() === m && utc.getUTCDate() === d;
}

function keyOrNullOr(y: number, m: number, d: number): string | null {
    if (!isValidDateKey(y, m, d)) return null;
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/** Next occurrence of `targetWeekday` strictly after `today`. */
function nextWeekday(today: string, targetWeekday: number): string {
    const delta = (targetWeekday - weekdayOf(today) + 7) % 7 || 7;
    return addDays(today, delta);
}

/** "<month> <day>" within the next 12 months: this year's date when it
 *  is still ahead (or today itself), otherwise next year's. */
function monthDay(today: string, monthIndex: number, day: number): string | null {
    const [year] = splitKey(today);
    const thisYear = keyOrNullOr(year, monthIndex, day);
    if (thisYear === null) return null;
    if (daysBetween(today, thisYear) >= 0) return thisYear;
    return keyOrNullOr(year + 1, monthIndex, day);
}

/** A scannable phrase pattern plus the builder turning the match into a
 *  date key. Patterns are word-bounded (\b), never anchored -- the two
 *  entry points anchor them differently. Small ordered regexes, not one
 *  big alternation (see code-standards: Bun backtracking pathology). */
interface DateCandidate {
    re: RegExp;
    build: (m: RegExpMatchArray, today: string) => string | null;
}

const weekdayLookup = (word: string): number | null => {
    const index = WEEKDAY_WORDS.indexOf(word.toLowerCase());
    return index === -1 ? null : index % 7;
};

const monthLookup = (word: string): number | null => {
    const index = MONTH_WORDS.indexOf(word.toLowerCase());
    return index === -1 ? null : index % 12;
};

const CANDIDATES: DateCandidate[] = [
    {
        re: /(\d{4})-(\d{2})-(\d{2})/,
        build: m => keyOrNullOr(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
    },
    {
        re: /\b(today|tomorrow|yesterday)\b/i,
        build: (m, today) => {
            const word = m[1]?.toLowerCase();
            if (word === 'tomorrow') return addDays(today, 1);
            if (word === 'yesterday') return addDays(today, -1);
            return today;
        },
    },
    {
        re: /\bin (\d{1,3}) (days?|weeks?)\b/i,
        build: (m, today) => {
            const count = Number(m[1]);
            if (count < 1) return null;
            if (m[2]?.toLowerCase().startsWith('week')) {
                return count > MAX_RELATIVE_WEEKS ? null : addDays(today, count * 7);
            }
            return count > MAX_RELATIVE_DAYS ? null : addDays(today, count);
        },
    },
    {
        re: new RegExp(`\\b(?:next )?(${WEEKDAY_ALT})\\b`, 'i'),
        build: (m, today) => {
            const day = m[1] === undefined ? null : weekdayLookup(m[1]);
            return day === null ? null : nextWeekday(today, day);
        },
    },
    {
        re: new RegExp(`\\b(${MONTH_ALT}) (\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'),
        build: (m, today) => {
            const month = m[1] === undefined ? null : monthLookup(m[1]);
            const day = m[2] === undefined ? null : Number(m[2]);
            if (month === null || day === null || day < 1 || day > MAX_DAY_OF_MONTH) {
                return null;
            }
            return monthDay(today, month, day);
        },
    },
];

/**
 * Resolve a string that must be exactly one date phrase.
 * Returns the date key, or null when the input is not a date.
 */
export function resolveDatePhrase(input: string, today: string): string | null {
    const cleaned = input
        .trim()
        .replace(/[.!?]+$/, '')
        .replace(/\s+/g, ' ');
    if (!cleaned) return null;
    for (const candidate of CANDIDATES) {
        const anchored = new RegExp(`^${candidate.re.source}$`, candidate.re.flags);
        const m = anchored.exec(cleaned);
        if (!m) continue;
        const date = candidate.build(m, today);
        if (date !== null) return date;
    }
    return null;
}

/**
 * Find the first date phrase in free text and strip it out.
 * Returns null when the text contains no date phrase.
 */
export function extractDatePhrase(text: string, today: string): ParsedDatePhrase | null {
    const trimmed = text.trim();
    if (!trimmed) return null;

    // Earliest match wins; ties go to the earlier candidate (order of
    // CANDIDATES is the priority).
    let best: { m: RegExpMatchArray; candidate: DateCandidate; index: number } | null = null;
    for (const candidate of CANDIDATES) {
        const m = candidate.re.exec(trimmed);
        if (!m || m.index === undefined) continue;
        if (best === null || m.index < best.index) best = { m, candidate, index: m.index };
    }
    if (!best) return null;

    const date = best.candidate.build(best.m, today);
    if (date === null) return null; // e.g. matched "march" but "april 31"

    const rest = (trimmed.slice(0, best.index) + trimmed.slice(best.index + best.m[0].length))
        .replace(/\s+/g, ' ')
        .trim();

    return { date, phrase: best.m[0], rest };
}
