import { describe, expect, it } from 'bun:test';
import type { RecurringTask } from '../types/recurringTask';
import { generateOccurrences, nextOccurrenceIso } from './recurringTaskUtils';

function makeTask(overrides: Partial<RecurringTask> = {}): RecurringTask {
    return {
        id: 'rt-1',
        text: 'Test task',
        notes: null,
        tags: [],
        frequency: 'daily',
        interval: 1,
        daysOfWeek: null,
        dayOfMonth: null,
        startDate: '2026-01-01',
        endDate: null,
        rolloverEnabled: true,
        startTime: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

describe('generateOccurrences', () => {
    describe('daily', () => {
        it('generates occurrences for a simple daily task', () => {
            const rt = makeTask({ frequency: 'daily', interval: 1, startDate: '2026-01-01' });
            const result = generateOccurrences(rt, '2026-01-03', '2026-01-05');
            expect(result).toEqual(['2026-01-03', '2026-01-04', '2026-01-05']);
        });

        it('respects interval > 1', () => {
            const rt = makeTask({ frequency: 'daily', interval: 2, startDate: '2026-01-01' });
            const result = generateOccurrences(rt, '2026-01-01', '2026-01-07');
            expect(result).toEqual(['2026-01-01', '2026-01-03', '2026-01-05', '2026-01-07']);
        });

        it('returns empty array when range is before template start', () => {
            const rt = makeTask({ frequency: 'daily', interval: 1, startDate: '2026-02-01' });
            const result = generateOccurrences(rt, '2026-01-01', '2026-01-31');
            expect(result).toEqual([]);
        });

        it('returns empty array when range is after template end', () => {
            const rt = makeTask({
                frequency: 'daily',
                interval: 1,
                startDate: '2026-01-01',
                endDate: '2026-01-05',
            });
            const result = generateOccurrences(rt, '2026-01-10', '2026-01-15');
            expect(result).toEqual([]);
        });

        it('clamps to template end date', () => {
            const rt = makeTask({
                frequency: 'daily',
                interval: 1,
                startDate: '2026-01-01',
                endDate: '2026-01-03',
            });
            const result = generateOccurrences(rt, '2026-01-01', '2026-01-10');
            expect(result).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
        });

        it('includes start and end dates when they are occurrences', () => {
            const rt = makeTask({ frequency: 'daily', interval: 1, startDate: '2026-01-01' });
            const result = generateOccurrences(rt, '2026-01-05', '2026-01-05');
            expect(result).toEqual(['2026-01-05']);
        });
    });

    describe('weekly', () => {
        it('generates weekly occurrences', () => {
            const rt = makeTask({ frequency: 'weekly', interval: 1, startDate: '2026-01-05' });
            const result = generateOccurrences(rt, '2026-01-05', '2026-02-02');
            expect(result).toEqual([
                '2026-01-05',
                '2026-01-12',
                '2026-01-19',
                '2026-01-26',
                '2026-02-02',
            ]);
        });

        it('respects interval for biweekly', () => {
            const rt = makeTask({ frequency: 'weekly', interval: 2, startDate: '2026-01-05' });
            const result = generateOccurrences(rt, '2026-01-05', '2026-02-02');
            expect(result).toEqual(['2026-01-05', '2026-01-19', '2026-02-02']);
        });
    });

    describe('monthly', () => {
        it('generates monthly occurrences', () => {
            const rt = makeTask({ frequency: 'monthly', interval: 1, startDate: '2026-01-15' });
            const result = generateOccurrences(rt, '2026-01-15', '2026-04-15');
            expect(result).toEqual(['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15']);
        });
    });

    describe('yearly', () => {
        it('generates yearly occurrences', () => {
            const rt = makeTask({ frequency: 'yearly', interval: 1, startDate: '2026-03-01' });
            const result = generateOccurrences(rt, '2026-03-01', '2028-03-01');
            expect(result).toEqual(['2026-03-01', '2027-03-01', '2028-03-01']);
        });
    });

    describe('edge cases', () => {
        it('returns empty array when startDate > endDate', () => {
            const rt = makeTask({ frequency: 'daily', interval: 1, startDate: '2026-01-01' });
            const result = generateOccurrences(rt, '2026-01-10', '2026-01-05');
            expect(result).toEqual([]);
        });

        it('uses interval of 1 when interval is 0 (defensive)', () => {
            const rt = makeTask({ frequency: 'daily', interval: 0, startDate: '2026-01-01' });
            const result = generateOccurrences(rt, '2026-01-01', '2026-01-03');
            expect(result).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
        });
    });

    describe('day-of-week scheduling (daysOfWeek)', () => {
        it('weekly on a weekday lands on that weekday, not the start date', () => {
            // 2026-09-01 is a Tuesday; "every friday" must land on Fridays.
            const rt = makeTask({
                frequency: 'weekly',
                interval: 1,
                daysOfWeek: [5],
                startDate: '2026-09-01',
            });
            const result = generateOccurrences(rt, '2026-09-01', '2026-09-20');
            expect(result).toEqual(['2026-09-04', '2026-09-11', '2026-09-18']);
        });

        it('includes the start date itself when it matches the weekday', () => {
            // 2026-09-04 is a Friday.
            const rt = makeTask({
                frequency: 'weekly',
                interval: 1,
                daysOfWeek: [5],
                startDate: '2026-09-04',
            });
            const result = generateOccurrences(rt, '2026-09-01', '2026-09-18');
            expect(result).toEqual(['2026-09-04', '2026-09-11', '2026-09-18']);
        });

        it('biweekly on a weekday skips the in-between week', () => {
            // Start Tuesday 2026-09-01; Fridays of week 0 and week 2.
            const rt = makeTask({
                frequency: 'weekly',
                interval: 2,
                daysOfWeek: [5],
                startDate: '2026-09-01',
            });
            const result = generateOccurrences(rt, '2026-09-01', '2026-10-02');
            expect(result).toEqual(['2026-09-04', '2026-09-18', '2026-10-02']);
        });

        it('daily restricted to weekdays skips the weekend', () => {
            // 2026-09-04 is a Friday; 09-05/09-06 are Sat/Sun.
            const rt = makeTask({
                frequency: 'daily',
                interval: 1,
                daysOfWeek: [1, 2, 3, 4, 5],
                startDate: '2026-09-01',
            });
            const result = generateOccurrences(rt, '2026-09-03', '2026-09-08');
            expect(result).toEqual(['2026-09-03', '2026-09-04', '2026-09-07', '2026-09-08']);
        });

        it('daily restricted to weekends lands only on Sat/Sun', () => {
            const rt = makeTask({
                frequency: 'daily',
                interval: 1,
                daysOfWeek: [0, 6],
                startDate: '2026-09-01',
            });
            const result = generateOccurrences(rt, '2026-09-01', '2026-09-14');
            expect(result).toEqual(['2026-09-05', '2026-09-06', '2026-09-12', '2026-09-13']);
        });

        it('multi-day weekly schedule hits each listed weekday', () => {
            // Mon/Wed/Fri from a Tuesday start (2026-09-01).
            const rt = makeTask({
                frequency: 'weekly',
                interval: 1,
                daysOfWeek: [1, 3, 5],
                startDate: '2026-09-01',
            });
            const result = generateOccurrences(rt, '2026-09-01', '2026-09-07');
            expect(result).toEqual(['2026-09-02', '2026-09-04', '2026-09-07']);
        });
    });

    describe('day-of-month scheduling', () => {
        it('monthly on day 15 lands on the 15th, not the start date', () => {
            const rt = makeTask({
                frequency: 'monthly',
                interval: 1,
                dayOfMonth: 15,
                startDate: '2026-09-01',
            });
            const result = generateOccurrences(rt, '2026-09-01', '2026-11-30');
            expect(result).toEqual(['2026-09-15', '2026-10-15', '2026-11-15']);
        });

        it('monthly on day 31 skips months without a 31st', () => {
            const rt = makeTask({
                frequency: 'monthly',
                interval: 1,
                dayOfMonth: 31,
                startDate: '2026-01-31',
            });
            const result = generateOccurrences(rt, '2026-01-01', '2026-04-30');
            expect(result).toEqual(['2026-01-31', '2026-03-31']);
        });

        it('interval 2 monthly on day 15 hits every second month', () => {
            const rt = makeTask({
                frequency: 'monthly',
                interval: 2,
                dayOfMonth: 15,
                startDate: '2026-01-15',
            });
            const result = generateOccurrences(rt, '2026-01-01', '2026-06-30');
            expect(result).toEqual(['2026-01-15', '2026-03-15', '2026-05-15']);
        });
    });

    describe('nextOccurrenceIso', () => {
        it('steps a daily schedule by one day', () => {
            const rt = makeTask({ frequency: 'daily', interval: 1, startDate: '2026-01-01' });
            expect(nextOccurrenceIso(rt, '2026-03-05')).toBe('2026-03-06');
        });

        it('skips a weekend for weekday-only schedules', () => {
            const rt = makeTask({
                frequency: 'daily',
                interval: 1,
                daysOfWeek: [1, 2, 3, 4, 5],
                startDate: '2026-01-01',
            });
            // 2026-09-04 is a Friday.
            expect(nextOccurrenceIso(rt, '2026-09-04')).toBe('2026-09-07');
        });

        it('jumps a week for weekly-on-friday', () => {
            const rt = makeTask({
                frequency: 'weekly',
                interval: 1,
                daysOfWeek: [5],
                startDate: '2026-01-02',
            });
            expect(nextOccurrenceIso(rt, '2026-03-06')).toBe('2026-03-13');
        });

        it('jumps a month for monthly-on-the-15th', () => {
            const rt = makeTask({
                frequency: 'monthly',
                interval: 1,
                dayOfMonth: 15,
                startDate: '2026-01-15',
            });
            expect(nextOccurrenceIso(rt, '2026-03-15')).toBe('2026-04-15');
        });

        it('ignores the template end date', () => {
            const rt = makeTask({
                frequency: 'daily',
                interval: 1,
                startDate: '2026-01-01',
                endDate: '2026-01-05',
            });
            expect(nextOccurrenceIso(rt, '2026-01-05')).toBe('2026-01-06');
        });

        it('walks over a missing day for day-of-month schedules', () => {
            const rt = makeTask({
                frequency: 'monthly',
                interval: 1,
                dayOfMonth: 31,
                startDate: '2026-01-31',
            });
            // No Feb 31 -> next lands on Mar 31.
            expect(nextOccurrenceIso(rt, '2026-01-31')).toBe('2026-03-31');
        });
    });
});
