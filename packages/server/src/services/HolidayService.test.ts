/**
 * HolidayService tests (v0.9.0).
 *
 * The .ics import reuses the ADR-009 IcalImportAdapter, so these tests
 * focus on the holiday-specific behavior layered on top: name/date
 * mapping, duplicate suppression (stored + in-batch), date-less event
 * skipping, and the remote-fetch path (stubbed -- the HTTP guarantees
 * live in fetchTextDefault and are covered by the API suite).
 */

import { describe, expect, test } from 'bun:test';
import { ImportValidationError, NativeDateProvider } from '@erledigen/shared';
import { InMemoryHolidayRepository } from '../adapters/data/InMemoryHolidayRepository';
import { HolidayService } from './HolidayService';

const dateProvider = new NativeDateProvider();

function makeService(fetchText?: (url: string) => Promise<string>) {
    const repo = new InMemoryHolidayRepository(dateProvider);
    const service = new HolidayService(repo, fetchText);
    return { repo, service };
}

const ICS = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Test//Holidays//EN',
    'BEGIN:VEVENT',
    'UID:new-year-2027',
    'DTSTART;VALUE=DATE:20270101',
    'SUMMARY:New Year Day',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:xmas-2027',
    'DTSTART;VALUE=DATE:20271225',
    'SUMMARY:Christmas Day',
    'END:VEVENT',
    'END:VCALENDAR',
].join('\r\n');

describe('HolidayService.importFromIcs', () => {
    test('maps VEVENTs to named dates', async () => {
        const { service } = makeService();
        const outcome = await service.importFromIcs(ICS);
        expect(outcome.holidays.map(h => h.name).sort()).toEqual(['Christmas Day', 'New Year Day']);
        expect(outcome.holidays.map(h => h.date).sort()).toEqual(['2027-01-01', '2027-12-25']);
        expect(outcome.skipped).toBe(0);
        expect(outcome.warnings).toEqual([]);
    });

    test('skips duplicates against the stored calendar', async () => {
        const { repo, service } = makeService();
        await repo.create({ name: 'New Year Day', date: '2027-01-01' });

        const outcome = await service.importFromIcs(ICS);
        expect(outcome.holidays.map(h => h.name)).toEqual(['Christmas Day']);
        expect(outcome.skipped).toBe(1);
    });

    test('re-importing the same document adds nothing', async () => {
        const { service } = makeService();
        await service.importFromIcs(ICS);
        const second = await service.importFromIcs(ICS);
        expect(second.holidays).toEqual([]);
        expect(second.skipped).toBe(2);
    });

    test('name matching is case-insensitive but the stored name is the first seen', async () => {
        const { service } = makeService();
        await service.importFromIcs(ICS);
        const variant = ICS.split('New Year Day').join('NEW YEAR DAY');
        const second = await service.importFromIcs(variant);
        expect(second.holidays).toEqual([]);
        expect(second.skipped).toBe(2);
    });

    test('a date-less VEVENT is skipped by the adapter with a warning', async () => {
        const { service } = makeService();
        const ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'BEGIN:VEVENT',
            'UID:dateless',
            'SUMMARY:Some floating entry',
            'END:VEVENT',
            'END:VCALENDAR',
        ].join('\r\n');
        const outcome = await service.importFromIcs(ics);
        expect(outcome.holidays).toEqual([]);
        expect(outcome.skipped).toBe(0); // the adapter dropped it pre-parse
        expect(outcome.warnings.some(w => w.message.includes('DTSTART'))).toBe(true);
    });

    test('passes adapter warnings through (recurring first-occurrence, etc.)', async () => {
        const { service } = makeService();
        const ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'BEGIN:VEVENT',
            'UID:rrule',
            'DTSTART;VALUE=DATE:20270301',
            'SUMMARY:Monthly staff thing',
            'RRULE:FREQ=MONTHLY',
            'END:VEVENT',
            'END:VCALENDAR',
        ].join('\r\n');
        const outcome = await service.importFromIcs(ics);
        expect(outcome.holidays.map(h => h.name)).toEqual(['Monthly staff thing']);
        expect(outcome.warnings.length).toBeGreaterThan(0);
    });

    test('rejects a document that is not iCal', async () => {
        const { service } = makeService();
        await expect(service.importFromIcs('just some text')).rejects.toThrow(
            ImportValidationError,
        );
    });

    test('a VCALENDAR with no VEVENTs imports nothing without failing', async () => {
        const { service } = makeService();
        const outcome = await service.importFromIcs(
            'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR',
        );
        expect(outcome.holidays).toEqual([]);
        expect(outcome.skipped).toBe(0);
        expect(outcome.warnings).toEqual([]);
    });
});

describe('HolidayService.importFromUrl', () => {
    test('imports the fetched document', async () => {
        const { service } = makeService(async () => ICS);
        const outcome = await service.importFromUrl('https://example.test/holidays.ics');
        expect(outcome.holidays.length).toBe(2);
    });

    test('propagates fetch failures', async () => {
        const { service } = makeService(async () => {
            throw new Error('Could not fetch https://example.test/x.ics (HTTP 500)');
        });
        await expect(service.importFromUrl('https://example.test/x.ics')).rejects.toThrow(
            'HTTP 500',
        );
    });
});
