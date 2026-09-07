/**
 * CsvExportAdapter tests -- the flat task-list view (RFC 4180 CSV).
 */

import { describe, expect, test } from 'bun:test';
import { CsvExportAdapter, DEFAULT_CSV_COLUMNS } from './CsvExportAdapter';
import { makeSnapshot, makeTask } from './exportFixtures';

describe('CsvExportAdapter', () => {
    const adapter = new CsvExportAdapter();

    test('declares the csv extension and text/csv media type', () => {
        expect(adapter.extension).toBe('csv');
        expect(adapter.contentType).toBe('text/csv');
    });

    test('writes a header row with the default columns', () => {
        const body = adapter.export(makeSnapshot());

        const [header] = body.split('\r\n');
        expect(header).toBe(DEFAULT_CSV_COLUMNS.join(','));
        expect(header).toContain('text');
        expect(header).toContain('priority');
    });

    test('writes one row per ACTIVE task; trash rows are excluded', () => {
        const snapshot = makeSnapshot({
            tasks: [
                makeTask({ id: 't1', text: 'Keep' }),
                makeTask({ id: 't2', text: 'Trashed', deletedAt: '2026-01-12T08:00:00.000Z' }),
            ],
        });

        const body = adapter.export(snapshot);

        const rows = body
            .split('\r\n')
            .slice(1)
            .filter(r => r.length > 0);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toContain('Keep');
    });

    test('maps task fields to columns (completed, tags, priority, times)', () => {
        const snapshot = makeSnapshot({
            tasks: [
                makeTask({
                    id: 't1',
                    text: 'Standup',
                    completed: true,
                    date: '2026-01-15',
                    tags: ['work', 'p1'],
                    startTime: '09:00',
                    endTime: '09:15',
                    notes: 'Daily sync',
                }),
                makeTask({ id: 't2', text: 'Read', tags: ['home'] }),
            ],
        });

        const lines = adapter.export(snapshot).split('\r\n');

        const columns: readonly string[] = DEFAULT_CSV_COLUMNS;
        const cell = (line: string, column: string): string => {
            const index = columns.indexOf(column);
            return line.split(',')[index] ?? '';
        };

        const standup = lines[1] ?? '';
        expect(cell(standup, 'completed')).toBe('true');
        expect(cell(standup, 'tags')).toBe('work p1');
        expect(cell(standup, 'priority')).toBe('p1');
        expect(cell(standup, 'startTime')).toBe('09:00');
        expect(cell(standup, 'endTime')).toBe('09:15');
        expect(cell(standup, 'notes')).toBe('Daily sync');

        const read = lines[2] ?? '';
        expect(cell(read, 'completed')).toBe('false');
        expect(cell(read, 'priority')).toBe('');
        // null fields render as empty cells, not the string "null"
        expect(cell(read, 'startTime')).toBe('');
    });

    test('escapes commas, quotes, and newlines per RFC 4180', () => {
        const snapshot = makeSnapshot({
            tasks: [
                makeTask({
                    id: 't1',
                    text: 'Say "hi", then leave',
                    notes: 'line one\nline two',
                }),
            ],
        });

        const lines = adapter.export(snapshot).split('\r\n');

        // The quoted row keeps its embedded newline on ONE logical line:
        // splitting on CRLF must NOT break the quoted field apart.
        expect(lines).toHaveLength(3); // header, row, trailing
        const row = lines[1] ?? '';
        expect(row).toContain('"Say ""hi"", then leave"');
        expect(row).toContain('"line one\nline two"');
    });

    test('subsets columns when constructed with a column list', () => {
        const scoped = new CsvExportAdapter(['text', 'date']);
        const snapshot = makeSnapshot({
            tasks: [makeTask({ id: 't1', text: 'Buy milk', date: '2026-01-15' })],
        });

        const lines = scoped.export(snapshot).split('\r\n');

        expect(lines[0]).toBe('text,date');
        expect(lines[1]).toBe('Buy milk,2026-01-15');
    });

    test('throws on unknown column names (programming error, not a user error)', () => {
        expect(() => new CsvExportAdapter(['text', 'nope'])).toThrow(/nope/);
    });
});
