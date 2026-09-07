import { describe, expect, test } from 'bun:test';
import { autoDetectCsvMapping, CsvImportAdapter } from './CsvImportAdapter';
import { ImportValidationError } from './ImportValidationError';
import { GENERIC_CSV } from './importFixtures';

describe('autoDetectCsvMapping', () => {
    test('maps common header names', () => {
        const mapping = autoDetectCsvMapping(['Title', 'Due Date', 'Notes', 'Tags', 'Done']);
        expect(mapping.text).toBe('Title');
        expect(mapping.date).toBe('Due Date');
        expect(mapping.notes).toBe('Notes');
        expect(mapping.tags).toBe('Tags');
        expect(mapping.completed).toBe('Done');
    });

    test('maps our own CSV export header (round-trip)', () => {
        const mapping = autoDetectCsvMapping([
            'id',
            'text',
            'notes',
            'completed',
            'date',
            'tags',
            'priority',
            'startTime',
            'endTime',
            'parentId',
        ]);
        expect(mapping.text).toBe('text');
        expect(mapping.notes).toBe('notes');
        expect(mapping.completed).toBe('completed');
        expect(mapping.date).toBe('date');
        expect(mapping.tags).toBe('tags');
        expect(mapping.priority).toBe('priority');
        expect(mapping.startTime).toBe('startTime');
        expect(mapping.endTime).toBe('endTime');
    });
});

describe('CsvImportAdapter', () => {
    test('auto-detect maps and parses every valid row', () => {
        const { tasks } = new CsvImportAdapter().import(GENERIC_CSV);
        expect(tasks.length).toBe(3);

        const report = tasks[0];
        expect(report?.text).toBe('Write the report');
        expect(report?.date).toBe('2026-03-20');
        expect(report?.notes).toBe('Final draft due');
        expect(report?.tags).toEqual(['work', 'writing']);
        expect(report?.completed).toBe(true);
        expect(report?.startTime).toBe('09:00');
        expect(report?.endTime).toBe('11:00');

        const someday = tasks[2];
        expect(someday?.date).toBeNull();
        expect(someday?.tags).toEqual(['reading', 'someday']);
        expect(someday?.completed).toBe(false);
    });

    test('skips rows with unparseable dates, reporting the source row', () => {
        const { tasks, warnings } = new CsvImportAdapter().import(GENERIC_CSV);
        expect(tasks.length).toBe(3);
        expect(warnings.length).toBe(1);
        expect(warnings[0]?.source).toBe(5);
        expect(warnings[0]?.message).toContain('03/18/2026');
    });

    test('maps priority p1/p2/p3 values onto tags', () => {
        const csv = 'task,prio\nUrgent,p1\nMedium,p3\nNo tag,p4\n';
        const { tasks } = new CsvImportAdapter().import(csv);
        expect(tasks[0]?.tags).toEqual(['p1']);
        expect(tasks[1]?.tags).toEqual(['p3']);
        expect(tasks[2]?.tags).toEqual([]);
    });

    test('explicit mapping overrides header names', () => {
        const csv = 'colA,colB,colC\nHello,2026-01-02,false\n';
        const { tasks } = new CsvImportAdapter({ text: 'colC', date: 'colB' }).import(csv);
        expect(tasks[0]?.text).toBe('false'); // colC mapped to text
        expect(tasks[0]?.date).toBe('2026-01-02');
    });

    test('reads the header for the mapping UI', () => {
        expect(CsvImportAdapter.readHeader(GENERIC_CSV)).toEqual([
            'Title',
            'Due Date',
            'Notes',
            'Tags',
            'Done',
            'Start Time',
            'End Time',
        ]);
    });

    test('throws when no text column can be mapped', () => {
        expect(() => new CsvImportAdapter().import('a,b\n1,2')).toThrow(ImportValidationError);
    });

    test('throws on an empty document', () => {
        expect(() => new CsvImportAdapter().import('')).toThrow(ImportValidationError);
    });

    test('accepts ISO dates with a trailing time part', () => {
        const csv = 'text,date\nA,2026-01-15 09:00:00\nB,2026-01-16\n';
        const { tasks } = new CsvImportAdapter().import(csv);
        expect(tasks[0]?.date).toBe('2026-01-15');
        expect(tasks[1]?.date).toBe('2026-01-16');
    });

    test('skips rows whose text exceeds the max length', () => {
        const long = 'x'.repeat(501);
        const csv = `text\nShort\n${long}\n`;
        const { tasks, warnings } = new CsvImportAdapter().import(csv);
        expect(tasks.length).toBe(1);
        expect(warnings[0]?.message).toContain('longer than');
    });
});
