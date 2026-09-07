/**
 * IcalExportAdapter tests -- RFC 5545 calendar export.
 *
 * Timed tasks become floating local times (Erledigen stores wall-clock
 * times without a zone); all-day tasks become date-valued VEVENTs.
 */

import { describe, expect, test } from 'bun:test';
import { makeSnapshot, makeTask } from './exportFixtures';
import { IcalExportAdapter } from './IcalExportAdapter';

describe('IcalExportAdapter', () => {
    const adapter = new IcalExportAdapter();

    test('declares the ics extension and text/calendar media type', () => {
        expect(adapter.extension).toBe('ics');
        expect(adapter.contentType).toBe('text/calendar');
    });

    test('wraps events in a VCALENDAR with the required properties', () => {
        const body = adapter.export(makeSnapshot());

        const lines = body.split('\r\n');
        expect(lines[0]).toBe('BEGIN:VCALENDAR');
        expect(lines).toContain('VERSION:2.0');
        expect(lines).toContain('PRODID:-//Erledigen//Erledigen Export//EN');
        expect(lines).toContain('CALSCALE:GREGORIAN');
        expect(lines.at(-2)).toBe('END:VCALENDAR');
        // Documents end with a trailing CRLF.
        expect(body.endsWith('\r\n')).toBe(true);
    });

    test('exports an all-day task as a date-valued VEVENT without DTEND', () => {
        const snapshot = makeSnapshot({
            tasks: [makeTask({ id: 't1', text: 'Buy milk', date: '2026-01-15' })],
        });

        const body = adapter.export(snapshot);

        expect(body).toContain('BEGIN:VEVENT');
        expect(body).toContain('DTSTART;VALUE=DATE:20260115');
        expect(body).not.toContain('DTEND');
        expect(body).toContain('END:VEVENT');
    });

    test('exports a timed task with floating DTSTART/DTEND; no DTEND when open-ended', () => {
        const snapshot = makeSnapshot({
            tasks: [
                makeTask({
                    id: 't1',
                    text: 'Standup',
                    date: '2026-01-15',
                    startTime: '09:00',
                    endTime: '10:15',
                }),
                makeTask({ id: 't2', text: 'Focus block', date: '2026-01-16', startTime: '14:00' }),
            ],
        });

        const body = adapter.export(snapshot);

        expect(body).toContain('DTSTART:20260115T090000');
        expect(body).toContain('DTEND:20260115T101500');
        // Open-ended task: a zero-length event, DTSTART only.
        expect(body).toContain('DTSTART:20260116T140000');
    });

    test('maps task fields to VEVENT properties', () => {
        const snapshot = makeSnapshot({
            tasks: [
                makeTask({
                    id: 't1',
                    text: 'Standup',
                    date: '2026-01-15',
                    tags: ['work', 'p1'],
                    notes: 'Daily sync',
                    startTime: '09:00',
                }),
            ],
        });

        const body = adapter.export(snapshot);

        expect(body).toContain('UID:t1@erledigen');
        expect(body).toContain('DTSTAMP:20260110T090000Z');
        expect(body).toContain('SUMMARY:Standup');
        expect(body).toContain('DESCRIPTION:Daily sync');
        expect(body).toContain('CATEGORIES:work,p1');
    });

    test('escapes special characters in text values (RFC 5545 3.3.11)', () => {
        const snapshot = makeSnapshot({
            tasks: [
                makeTask({
                    id: 't1',
                    text: 'A; B, C\\D',
                    date: '2026-01-15',
                    notes: 'line one\nline two',
                }),
            ],
        });

        const body = adapter.export(snapshot);

        expect(body).toContain('SUMMARY:A\\; B\\, C\\\\D');
        expect(body).toContain('DESCRIPTION:line one\\nline two');
    });

    test('excludes Someday and soft-deleted tasks', () => {
        const snapshot = makeSnapshot({
            tasks: [
                makeTask({ id: 't1', text: 'Kept', date: '2026-01-15' }),
                makeTask({ id: 't2', text: 'Someday', date: null }),
                makeTask({
                    id: 't3',
                    text: 'Trashed',
                    date: '2026-01-15',
                    deletedAt: '2026-01-12T08:00:00.000Z',
                }),
            ],
        });

        const body = adapter.export(snapshot);

        expect(body).toContain('SUMMARY:Kept');
        expect(body).not.toContain('Someday');
        expect(body).not.toContain('Trashed');
    });

    test('folds lines longer than 75 octets so they survive round-trip unfolding', () => {
        const longText = 'L'.repeat(200);
        const snapshot = makeSnapshot({
            tasks: [makeTask({ id: 't1', text: longText, date: '2026-01-15' })],
        });

        const body = adapter.export(snapshot);

        // Every physical line stays within the 75-octet limit.
        for (const line of body.split('\r\n')) {
            expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
        }
        // Unfolding (strip continuation whitespace) restores the full value.
        const unfolded = body.replaceAll('\r\n ', '');
        expect(unfolded).toContain(`SUMMARY:${longText}`);
    });
});
