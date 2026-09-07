import { describe, expect, test } from 'bun:test';
import type { Task } from '../../types/task';
import { makeSnapshot, makeTask } from '../export/exportFixtures';
import { ImportValidationError } from './ImportValidationError';
import { JsonRestoreImportAdapter } from './JsonRestoreImportAdapter';

const adapter = new JsonRestoreImportAdapter();

const roundTrippable = makeSnapshot({
    tasks: [
        makeTask({ id: '1', text: 'Active task', date: '2026-01-15' }),
        makeTask({
            id: '2',
            text: 'Trashed task',
            date: null,
            deletedAt: '2026-01-20T10:00:00.000Z',
        }),
        makeTask({ id: '3', text: 'Child', parentId: '1', date: '2026-01-15' }),
    ],
});

describe('JsonRestoreImportAdapter', () => {
    test('round-trips a snapshot through JSON.stringify', () => {
        const source = JSON.stringify(roundTrippable);
        const parsed = adapter.import(source);
        expect(parsed.tasks.length).toBe(3);
        expect(parsed.tasks[2]?.parentId).toBe('1');
        expect(parsed.tasks[1]?.deletedAt).toBe('2026-01-20T10:00:00.000Z');
    });

    test('rejects non-JSON with a clear message', () => {
        expect(() => adapter.import('not json')).toThrow(ImportValidationError);
    });

    test('rejects a JSON document that is not an Erledigen export', () => {
        expect(() => adapter.import(JSON.stringify({ hello: 'world' }))).toThrow(
            /missing format: 'erledigen-export'/,
        );
    });

    test('rejects an unsupported snapshot version', () => {
        const future = { ...roundTrippable, version: 2 };
        expect(() => adapter.import(JSON.stringify(future))).toThrow(
            /Unsupported export version: 2/,
        );
    });

    test('rejects a task missing required fields', () => {
        const bad = makeSnapshot({
            tasks: [makeTask({ id: '1', text: 'no completed field', date: '2026-01-15' })],
        });
        delete (bad.tasks[0] as Partial<Task>).completed;
        expect(() => adapter.import(JSON.stringify(bad))).toThrow(/tasks\[0\].*completed/);
    });

    test('rejects an invalid task date', () => {
        const bad = makeSnapshot({ tasks: [makeTask({ id: '1', text: 'x', date: '15-01-2026' })] });
        expect(() => adapter.import(JSON.stringify(bad))).toThrow(/date/);
    });

    test('rejects duplicate task ids', () => {
        const bad = makeSnapshot({
            tasks: [makeTask({ id: '1', text: 'a' }), makeTask({ id: '1', text: 'b' })],
        });
        expect(() => adapter.import(JSON.stringify(bad))).toThrow(/duplicate task ids/);
    });

    test('rejects parentId pointing outside the snapshot', () => {
        const bad = makeSnapshot({
            tasks: [makeTask({ id: '1', text: 'orphan', parentId: 'missing' })],
        });
        expect(() => adapter.import(JSON.stringify(bad))).toThrow(/parentId missing/);
    });

    test('rejects someDayGroupId pointing outside the snapshot', () => {
        const bad = makeSnapshot({
            tasks: [makeTask({ id: '1', text: 'orphan', someDayGroupId: 'g404' })],
        });
        expect(() => adapter.import(JSON.stringify(bad))).toThrow(/someDayGroupId g404/);
    });

    test('rejects recurringTaskId pointing outside the snapshot', () => {
        const bad = makeSnapshot({
            tasks: [makeTask({ id: '1', text: 'orphan', recurringTaskId: 'rt404' })],
        });
        expect(() => adapter.import(JSON.stringify(bad))).toThrow(/recurringTaskId rt404/);
    });

    test('rejects userPreferences missing required keys', () => {
        const bad = makeSnapshot();
        delete (bad.userPreferences as unknown as Record<string, unknown>)['theme'];
        expect(() => adapter.import(JSON.stringify(bad))).toThrow(/userPreferences/);
    });

    test('accepts a snapshot with optional task keys omitted (additive change)', () => {
        const doc = JSON.parse(JSON.stringify(roundTrippable));
        for (const task of doc.tasks) {
            delete task.position;
            delete task.state;
            delete task.reminder;
        }
        const parsed = adapter.import(JSON.stringify(doc));
        expect(parsed.tasks[0]?.position).toBeNull();
        expect(parsed.tasks[0]?.state).toBeNull();
        expect(parsed.tasks[0]?.reminder).toBeNull();
    });
});
