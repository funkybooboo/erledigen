import { describe, expect, it } from 'bun:test';
import type { RecurringTask } from '../types/recurringTask';
import { describeRecurrence, formatFrequency } from './formatFrequency';
import type { ParsedRecurrence } from './parseRecurrence';
import { parseRecurrence } from './parseRecurrence';

/** Parse or fail the test with a readable message. */
function mustParse(input: string): ParsedRecurrence {
    const parsed = parseRecurrence(input);
    if (parsed === null) throw new Error(`expected "${input}" to parse as a recurrence`);
    return parsed;
}

describe('parseRecurrence', () => {
    describe('daily', () => {
        it.each([
            ['Meditate every day', 'Meditate', 1],
            ['Meditate everyday', 'Meditate', 1],
            ['Take vitamins daily', 'Take vitamins', 1],
            ['Water plants every other day', 'Water plants', 2],
            ['Deep clean every 3 days', 'Deep clean', 3],
            ['Water the fern every 14 days.', 'Water the fern', 14],
        ])('%s -> daily/%d', (input, cleanText, interval) => {
            const parsed = mustParse(input);
            expect(parsed.cleanText).toBe(cleanText);
            expect(parsed.schedule.frequency).toBe('daily');
            expect(parsed.schedule.interval).toBe(interval);
            expect(parsed.schedule.dayOfWeek).toBeNull();
            expect(parsed.schedule.dayOfMonth).toBeNull();
        });
    });

    describe('weekly', () => {
        it.each([
            ['Take out trash every week', 'Take out trash', 1, null],
            ['Review budget weekly', 'Review budget', 1, null],
            ['Call mom every sunday', 'Call mom', 1, 0],
            ['Call mom every Sunday', 'Call mom', 1, 0],
            ['Call mom every sundays', 'Call mom', 1, 0],
            ['Standup every mon', 'Standup', 1, 1],
            ['Dinner with parents every friday', 'Dinner with parents', 1, 5],
            ['Sprint planning weekly on tuesday', 'Sprint planning', 1, 2],
            ['Sprint planning every week on tuesday', 'Sprint planning', 1, 2],
            ['Pay cleaner every 2 weeks on friday', 'Pay cleaner', 2, 5],
            ['Water garden every 2 weeks', 'Water garden', 2, null],
        ])('%s -> weekly', (input, cleanText, interval, dayOfWeek) => {
            const parsed = mustParse(input);
            expect(parsed.cleanText).toBe(cleanText);
            expect(parsed.schedule.frequency).toBe('weekly');
            expect(parsed.schedule.interval).toBe(interval);
            expect(parsed.schedule.dayOfWeek).toBe(dayOfWeek);
        });
    });

    describe('monthly', () => {
        it.each([
            ['Pay rent every month', 'Pay rent', 1, null],
            ['Pay rent monthly', 'Pay rent', 1, null],
            ['Pay credit card monthly on the 15th', 'Pay credit card', 1, 15],
            ['Pay credit card every month on the 15th', 'Pay credit card', 1, 15],
            ['Pay credit card monthly on day 15', 'Pay credit card', 1, 15],
            ['Trim hair every 2 months', 'Trim hair', 2, null],
            ['Back up laptop every 6 months on the 1st', 'Back up laptop', 6, 1],
        ])('%s -> monthly', (input, cleanText, interval, dayOfMonth) => {
            const parsed = mustParse(input);
            expect(parsed.cleanText).toBe(cleanText);
            expect(parsed.schedule.frequency).toBe('monthly');
            expect(parsed.schedule.interval).toBe(interval);
            expect(parsed.schedule.dayOfMonth).toBe(dayOfMonth);
        });
    });

    describe('yearly', () => {
        it.each([
            ['Renal insurance renewal every year', 'Renal insurance renewal', 1],
            ['File taxes yearly', 'File taxes', 1],
            ['Renew passport annually', 'Renew passport', 1],
            ['Eye exam every 2 years', 'Eye exam', 2],
        ])('%s -> yearly', (input, cleanText, interval) => {
            const parsed = mustParse(input);
            expect(parsed.cleanText).toBe(cleanText);
            expect(parsed.schedule.frequency).toBe('yearly');
            expect(parsed.schedule.interval).toBe(interval);
        });
    });

    describe('time suffix', () => {
        it.each([
            ['Meditate every day at 4:00pm', '16:00'],
            ['Meditate every day at 4pm', '16:00'],
            ['Meditate every day at 4:30 pm', '16:30'],
            ['Meditate every day at 9am', '09:00'],
            ['Stretch every day at noon', '12:00'],
            ['Sleep meds every day at midnight', '00:00'],
            ['Deploy every friday at 16:00', '16:00'],
            ['Standup every weekday at 9:30am', null], // weekday unsupported -> no match
        ])('%s -> startTime %s', (input, expected) => {
            if (expected === null) {
                expect(parseRecurrence(input)).toBeNull();
            } else {
                expect(mustParse(input).schedule.startTime).toBe(expected);
            }
        });

        it('captures the full phrase including time', () => {
            expect(mustParse('Meditate every day at 4:00pm').phrase).toBe('every day at 4:00pm');
        });

        it.each([
            ['Meditate every day at 13pm'],
            ['Meditate every day at 25:00'],
            ['Meditate every day at 4:99'],
        ])('rejects invalid time: %s', input => {
            expect(parseRecurrence(input)).toBeNull();
        });
    });

    describe('non-matching text stays a normal task', () => {
        it.each([
            [''], // empty
            ['   '],
            ['Buy milk'],
            ['Daily standup notes'], // "daily" not trailing
            ['Every day gratitude journal'], // phrase not at end
            ['Review the weekly report'], // "weekly" not trailing
            ['Friday meeting with team'], // no every/on prefix
            ['every day'], // nothing left for clean text
            ['every day at noon'], // still nothing left
            ['Check furnace filter every 0 days'], // interval must be >= 1
            ['Pay rent every month on the 32nd'], // invalid day of month
            ['Do the thing every 999 days'], // interval cap
        ])('%s -> null', input => {
            expect(parseRecurrence(input)).toBeNull();
        });
    });

    describe('punctuation and separators', () => {
        it('strips trailing sentence punctuation', () => {
            const parsed = mustParse('Walk the dog every day!');
            expect(parsed.cleanText).toBe('Walk the dog');
            expect(parsed.schedule.frequency).toBe('daily');
        });

        it('strips a separating comma before the phrase', () => {
            const parsed = mustParse('Water plants, every other day');
            expect(parsed.cleanText).toBe('Water plants');
            expect(parsed.schedule.interval).toBe(2);
        });
    });
});

describe('describeRecurrence / formatFrequency', () => {
    it('describes schedules the parser produces', () => {
        expect(
            describeRecurrence({
                frequency: 'daily',
                interval: 1,
                dayOfWeek: null,
                dayOfMonth: null,
                startTime: null,
            }),
        ).toBe('Every day');
        expect(
            describeRecurrence({
                frequency: 'daily',
                interval: 2,
                dayOfWeek: null,
                dayOfMonth: null,
                startTime: null,
            }),
        ).toBe('Every other day');
        expect(
            describeRecurrence({
                frequency: 'daily',
                interval: 3,
                dayOfWeek: null,
                dayOfMonth: null,
                startTime: null,
            }),
        ).toBe('Every 3 days');
        expect(
            describeRecurrence({
                frequency: 'weekly',
                interval: 1,
                dayOfWeek: 5,
                dayOfMonth: null,
                startTime: null,
            }),
        ).toBe('Every Friday');
        expect(
            describeRecurrence({
                frequency: 'weekly',
                interval: 2,
                dayOfWeek: 5,
                dayOfMonth: null,
                startTime: null,
            }),
        ).toBe('Every 2 weeks on Friday');
        expect(
            describeRecurrence({
                frequency: 'monthly',
                interval: 1,
                dayOfWeek: null,
                dayOfMonth: 15,
                startTime: null,
            }),
        ).toBe('Monthly on day 15');
        expect(
            describeRecurrence({
                frequency: 'daily',
                interval: 1,
                dayOfWeek: null,
                dayOfMonth: null,
                startTime: '16:00',
            }),
        ).toBe('Every day at 4:00pm');
        expect(
            describeRecurrence({
                frequency: 'yearly',
                interval: 1,
                dayOfWeek: null,
                dayOfMonth: null,
                startTime: null,
            }),
        ).toBe('Every year');
    });

    it('formatFrequency describes a full RecurringTask', () => {
        const rt = {
            frequency: 'weekly',
            interval: 1,
            dayOfWeek: 0,
            dayOfMonth: null,
            startTime: '10:30',
        } as RecurringTask;
        expect(formatFrequency(rt)).toBe('Every Sunday at 10:30am');
    });
});
