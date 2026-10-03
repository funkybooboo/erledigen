import { describe, expect, it } from 'bun:test';
import { extractDatePhrase, resolveDatePhrase } from './parseDatePhrase';

// 2026-10-01 is a Thursday -- fixed "today" so weekday math is stable.
const TODAY = '2026-10-01';

describe('resolveDatePhrase (strict -- the whole input is one phrase)', () => {
    it('resolves the relative day words', () => {
        expect(resolveDatePhrase('today', TODAY)).toBe('2026-10-01');
        expect(resolveDatePhrase('tomorrow', TODAY)).toBe('2026-10-02');
        expect(resolveDatePhrase('yesterday', TODAY)).toBe('2026-09-30');
    });

    it('is case-insensitive and tolerates trailing punctuation', () => {
        expect(resolveDatePhrase('Tomorrow', TODAY)).toBe('2026-10-02');
        expect(resolveDatePhrase('NEXT MONDAY.', TODAY)).toBe('2026-10-05');
    });

    it('resolves "in N days" and "in N weeks"', () => {
        expect(resolveDatePhrase('in 3 days', TODAY)).toBe('2026-10-04');
        expect(resolveDatePhrase('in 1 day', TODAY)).toBe('2026-10-02');
        expect(resolveDatePhrase('in 2 weeks', TODAY)).toBe('2026-10-15');
    });

    it('rejects out-of-range and zero relative offsets', () => {
        expect(resolveDatePhrase('in 0 days', TODAY)).toBeNull();
        expect(resolveDatePhrase('in 400 days', TODAY)).toBeNull();
        expect(resolveDatePhrase('in 53 weeks', TODAY)).toBeNull();
    });

    it('resolves "next <weekday>" to the next occurrence strictly after today', () => {
        // Thursday -> the coming Friday is 1 day out.
        expect(resolveDatePhrase('next friday', TODAY)).toBe('2026-10-02');
        // ... and the coming Monday 4 days out.
        expect(resolveDatePhrase('next monday', TODAY)).toBe('2026-10-05');
        // "next thursday" on a Thursday skips a full week.
        expect(resolveDatePhrase('next thursday', TODAY)).toBe('2026-10-08');
        // Sunday both as full name and 3-letter abbreviation.
        expect(resolveDatePhrase('next sunday', TODAY)).toBe('2026-10-04');
        expect(resolveDatePhrase('next sun', TODAY)).toBe('2026-10-04');
    });

    it('resolves a bare weekday the same way as "next <weekday>"', () => {
        expect(resolveDatePhrase('friday', TODAY)).toBe('2026-10-02');
        expect(resolveDatePhrase('wed', TODAY)).toBe('2026-10-07');
    });

    it('resolves "<month> <day>" within the next 12 months', () => {
        expect(resolveDatePhrase('october 15', TODAY)).toBe('2026-10-15');
        expect(resolveDatePhrase('oct 15', TODAY)).toBe('2026-10-15');
        expect(resolveDatePhrase('december 25', TODAY)).toBe('2026-12-25');
        // March 15 already passed this year -> next year's.
        expect(resolveDatePhrase('march 15', TODAY)).toBe('2027-03-15');
        expect(resolveDatePhrase('march 15th', TODAY)).toBe('2027-03-15');
        // Today's month/day resolves to today, not next year.
        expect(resolveDatePhrase('october 1', TODAY)).toBe('2026-10-01');
    });

    it('rejects impossible month/day combinations', () => {
        expect(resolveDatePhrase('april 31', TODAY)).toBeNull();
        expect(resolveDatePhrase('february 30', TODAY)).toBeNull();
        expect(resolveDatePhrase('march 99', TODAY)).toBeNull();
        expect(resolveDatePhrase('march 0', TODAY)).toBeNull();
    });

    it('resolves a literal ISO date key', () => {
        expect(resolveDatePhrase('2026-10-15', TODAY)).toBe('2026-10-15');
        expect(resolveDatePhrase('2027-01-02', TODAY)).toBe('2027-01-02');
    });

    it('rejects malformed or non-date input', () => {
        expect(resolveDatePhrase('2026-13-01', TODAY)).toBeNull();
        expect(resolveDatePhrase('2026-02-30', TODAY)).toBeNull();
        expect(resolveDatePhrase('2026-10-5', TODAY)).toBeNull();
        expect(resolveDatePhrase('buy milk', TODAY)).toBeNull();
        expect(resolveDatePhrase('tomorrow morning', TODAY)).toBeNull();
        expect(resolveDatePhrase('', TODAY)).toBeNull();
        expect(resolveDatePhrase('march', TODAY)).toBeNull();
    });
});

describe('extractDatePhrase (scan free text, strip the match)', () => {
    it('extracts a trailing phrase and leaves the task text', () => {
        const parsed = extractDatePhrase('buy milk tomorrow #work #p1', TODAY);
        expect(parsed?.date).toBe('2026-10-02');
        expect(parsed?.phrase).toBe('tomorrow');
        expect(parsed?.rest).toBe('buy milk #work #p1');
    });

    it('extracts a phrase from the middle of the text', () => {
        const parsed = extractDatePhrase('remind me in 3 days to call mom', TODAY);
        expect(parsed?.date).toBe('2026-10-04');
        expect(parsed?.rest).toBe('remind me to call mom');
    });

    it('extracts weekday, month-day, and ISO phrases', () => {
        expect(extractDatePhrase('team sync next monday', TODAY)).toMatchObject({
            date: '2026-10-05',
            rest: 'team sync',
        });
        expect(extractDatePhrase('file taxes march 15', TODAY)).toMatchObject({
            date: '2027-03-15',
            rest: 'file taxes',
        });
        expect(extractDatePhrase('launch due 2026-10-15 sharp', TODAY)).toMatchObject({
            date: '2026-10-15',
            rest: 'launch due sharp',
        });
    });

    it('takes the first phrase when several appear', () => {
        const parsed = extractDatePhrase('march 15 sync on friday', TODAY);
        expect(parsed?.date).toBe('2027-03-15');
        expect(parsed?.rest).toBe('sync on friday');
    });

    it('does not match weekday fragments inside longer words', () => {
        expect(extractDatePhrase('satellite launch', TODAY)).toBeNull();
        expect(extractDatePhrase('invest in the fund', TODAY)).toBeNull();
        expect(extractDatePhrase('march madness viewing', TODAY)).toBeNull();
    });

    it('returns null for text without a date phrase', () => {
        expect(extractDatePhrase('buy milk', TODAY)).toBeNull();
        expect(extractDatePhrase('', TODAY)).toBeNull();
    });
});
