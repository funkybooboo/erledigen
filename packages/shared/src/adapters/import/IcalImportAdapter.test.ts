import { describe, expect, test } from 'bun:test';
import { IcalImportAdapter } from './IcalImportAdapter';
import { ImportValidationError } from './ImportValidationError';
import { ICAL_ERLEDIGEN_EXPORT, ICAL_GOOGLE_EXPORT } from './importFixtures';

describe('IcalImportAdapter', () => {
    test('imports TZID-timed VEVENTs with date, start, and end times', () => {
        const { tasks } = new IcalImportAdapter().import(ICAL_GOOGLE_EXPORT);

        const dentist = tasks.find(t => t.text === 'Dentist appointment');
        expect(dentist).toBeDefined();
        // 2026-03-14 09:00 Denver converts to the runtime zone -- the
        // important contract: a valid local date + both times present.
        expect(dentist?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(dentist?.startTime).toMatch(/^\d{2}:\d{2}$/);
        expect(dentist?.endTime).toMatch(/^\d{2}:\d{2}$/);
        expect(dentist?.notes).toBe('Cleaning, and bring the referral');
        expect(dentist?.tags).toEqual(['health', 'appointments']);
    });

    test('imports all-day events as date-only tasks', () => {
        const { tasks } = new IcalImportAdapter().import(ICAL_GOOGLE_EXPORT);
        const trip = tasks.find(t => t.text === 'Trip to the mountains');
        expect(trip?.date).toBe('2026-03-16');
        expect(trip?.startTime).toBeNull();
        expect(trip?.endTime).toBeNull();
    });

    test('imports recurring events as their first occurrence with a warning', () => {
        const { tasks, warnings } = new IcalImportAdapter().import(ICAL_GOOGLE_EXPORT);
        expect(tasks.some(t => t.text === 'Weekly review')).toBe(true);
        expect(
            warnings.some(
                w => w.message.includes('Weekly review') && w.message.includes('first occurrence'),
            ),
        ).toBe(true);
    });

    test('skips canceled events with a warning', () => {
        const { tasks, warnings } = new IcalImportAdapter().import(ICAL_GOOGLE_EXPORT);
        expect(tasks.some(t => t.text === 'Canceled picnic')).toBe(false);
        expect(warnings.some(w => w.message.includes('Canceled picnic'))).toBe(true);
    });

    test('round-trips our own floating-time export', () => {
        const { tasks, warnings } = new IcalImportAdapter().import(ICAL_ERLEDIGEN_EXPORT);
        expect(warnings).toEqual([]);
        expect(tasks.length).toBe(2);
        expect(tasks[0]?.text).toBe('Plan the weekend');
        expect(tasks[0]?.date).toBe('2026-01-15');
        expect(tasks[0]?.startTime).toBe('09:00');
        expect(tasks[0]?.endTime).toBe('10:00');
        expect(tasks[1]?.date).toBe('2026-01-16');
        expect(tasks[1]?.startTime).toBeNull();
    });

    test('unfolds continuation lines in summaries (RFC 5545 3.1)', () => {
        const ics = [
            'BEGIN:VCALENDAR',
            'BEGIN:VEVENT',
            'SUMMARY:A very long summary that',
            '  was folded across lines',
            'DTSTART:20260401T120000',
            'END:VEVENT',
            'END:VCALENDAR',
        ].join('\r\n');
        const { tasks } = new IcalImportAdapter().import(ics);
        expect(tasks[0]?.text).toBe('A very long summary that was folded across lines');
    });

    test('converts UTC times to the local wall clock', () => {
        const ics = [
            'BEGIN:VCALENDAR',
            'BEGIN:VEVENT',
            'SUMMARY:UTC event',
            'DTSTART:20260315T230000Z',
            'END:VEVENT',
            'END:VCALENDAR',
        ].join('\r\n');
        const { tasks } = new IcalImportAdapter().import(ics);
        const event = tasks[0];
        expect(event?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(event?.startTime).toMatch(/^\d{2}:\d{2}$/);
    });

    test('skips VEVENTs without a parseable DTSTART', () => {
        const ics = [
            'BEGIN:VCALENDAR',
            'BEGIN:VEVENT',
            'SUMMARY:Undated',
            'END:VEVENT',
            'END:VCALENDAR',
        ].join('\r\n');
        const { tasks, warnings } = new IcalImportAdapter().import(ics);
        expect(tasks).toEqual([]);
        expect(warnings[0]?.message).toContain('Undated');
    });

    test('throws for a document without BEGIN:VCALENDAR', () => {
        expect(() => new IcalImportAdapter().import('SUMMARY:nope')).toThrow(ImportValidationError);
    });

    test('reports VTODO components as skipped', () => {
        const ics = [
            'BEGIN:VCALENDAR',
            'BEGIN:VTODO',
            'SUMMARY:A todo not an event',
            'END:VTODO',
            'END:VCALENDAR',
        ].join('\r\n');
        const { tasks, warnings } = new IcalImportAdapter().import(ics);
        expect(tasks).toEqual([]);
        expect(warnings.some(w => w.message.includes('VTODO'))).toBe(true);
    });

    test('handles multi-day all-day events (no end time, no warning)', () => {
        const ics = [
            'BEGIN:VCALENDAR',
            'BEGIN:VEVENT',
            'SUMMARY:Conference',
            'DTSTART;VALUE=DATE:20260320',
            'DTEND;VALUE=DATE:20260322',
            'END:VEVENT',
            'END:VCALENDAR',
        ].join('\r\n');
        const { tasks, warnings } = new IcalImportAdapter().import(ics);
        const conference = tasks[0];
        expect(conference?.date).toBe('2026-03-20');
        expect(conference?.endTime).toBeNull();
        expect(warnings).toEqual([]);
    });
});
