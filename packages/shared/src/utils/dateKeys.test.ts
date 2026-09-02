import { describe, expect, it } from 'bun:test';
import { addDays, dateRangeKeys, daysBetween, keyFromParts, splitKey, weekdayOf } from './dateKeys';

describe('splitKey / keyFromParts', () => {
    it('splits a key into year, 0-based month, day', () => {
        expect(splitKey('2026-09-01')).toEqual([2026, 8, 1]);
    });

    it('round-trips through keyFromParts', () => {
        expect(keyFromParts(2026, 8, 1)).toBe('2026-09-01');
    });

    it('zero-pads month and day', () => {
        expect(keyFromParts(2026, 0, 5)).toBe('2026-01-05');
    });
});

describe('addDays', () => {
    it('adds days within a month', () => {
        expect(addDays('2026-01-01', 10)).toBe('2026-01-11');
    });

    it('rolls over month and year boundaries', () => {
        expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    });

    it('handles negative days', () => {
        expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
        expect(addDays('2024-03-01', -1)).toBe('2024-02-29'); // leap year
    });

    it('is DST-proof across the US spring-forward day', () => {
        // 2026-03-08 is a 23-hour day in America/Denver; key math must not drift.
        expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
        expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    });
});

describe('daysBetween', () => {
    it('is positive when the second date is later', () => {
        expect(daysBetween('2026-01-01', '2026-01-31')).toBe(30);
        expect(daysBetween('2026-01-31', '2026-01-01')).toBe(-30);
    });

    it('spans month and year boundaries', () => {
        expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
        expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364);
    });
});

describe('weekdayOf', () => {
    it('returns 0 for Sunday and 6 for Saturday', () => {
        expect(weekdayOf('2026-09-06')).toBe(0); // Sunday
        expect(weekdayOf('2026-09-05')).toBe(6); // Saturday
    });

    it('agrees across a known week', () => {
        const days = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];
        expect(days.map(weekdayOf)).toEqual([2, 3, 4, 5, 6]); // Tue..Sat
    });
});

describe('dateRangeKeys', () => {
    it('lists every day in an inclusive range', () => {
        expect(dateRangeKeys('2026-09-01', '2026-09-04')).toEqual([
            '2026-09-01',
            '2026-09-02',
            '2026-09-03',
            '2026-09-04',
        ]);
    });

    it('rolls across month and year boundaries', () => {
        expect(dateRangeKeys('2026-12-30', '2027-01-02')).toEqual([
            '2026-12-30',
            '2026-12-31',
            '2027-01-01',
            '2027-01-02',
        ]);
    });

    it('returns a single key for a one-day range', () => {
        expect(dateRangeKeys('2026-09-01', '2026-09-01')).toEqual(['2026-09-01']);
    });

    it('returns an empty array for an inverted range instead of looping', () => {
        expect(dateRangeKeys('2026-09-04', '2026-09-01')).toEqual([]);
    });
});
