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
        const future = { ...roundTrippable, version: 99 };
        expect(() => adapter.import(JSON.stringify(future))).toThrow(
            /Unsupported export version: 99/,
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

    test('rejects somedayListId pointing outside the snapshot', () => {
        const bad = makeSnapshot({
            tasks: [makeTask({ id: '1', text: 'orphan', somedayListId: 'l404' })],
        });
        expect(() => adapter.import(JSON.stringify(bad))).toThrow(/somedayListId l404/);
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

    // -- day notes (v0.10.0) ---------------------------------------------

    const dayNote = {
        id: 'n1',
        date: '2026-01-15',
        notes: '# Margin note\n- buy stamps',
        createdAt: '2026-01-15T08:00:00.000Z',
        updatedAt: '2026-01-15T08:00:00.000Z',
    };

    test('round-trips day notes', () => {
        const parsed = adapter.import(JSON.stringify(makeSnapshot({ dayNotes: [dayNote] })));
        expect(parsed.dayNotes).toEqual([dayNote]);
    });

    test('accepts snapshots that predate day notes (missing key restores as [])', () => {
        const doc = JSON.parse(JSON.stringify(roundTrippable));
        delete doc.dayNotes;
        const parsed = adapter.import(JSON.stringify(doc));
        expect(parsed.dayNotes).toEqual([]);
    });

    test('rejects a day note with an invalid date', () => {
        const bad = makeSnapshot({ dayNotes: [{ ...dayNote, date: '15-01-2026' }] });
        expect(() => adapter.import(JSON.stringify(bad))).toThrow(/dayNotes\[0\].*date/);
    });

    test('rejects a day note with non-string notes', () => {
        const bad = makeSnapshot({
            dayNotes: [{ ...dayNote, notes: 42 as unknown as string }],
        });
        expect(() => adapter.import(JSON.stringify(bad))).toThrow(/dayNotes\[0\].*notes/);
    });

    test('rejects duplicate day-note dates (one row per date)', () => {
        const bad = makeSnapshot({ dayNotes: [dayNote, { ...dayNote, id: 'n2' }] });
        expect(() => adapter.import(JSON.stringify(bad))).toThrow(/duplicate dayNote/);
    });
});

// -- version 1 -> 2 mapping (ADR-026, v0.16.0) ----------------------

const v1Snapshot = {
    format: 'erledigen-export',
    version: 1 as const,
    exportedAt: '2026-01-15T12:00:00.000Z',
    tasks: [
        {
            ...makeTask({ id: 't1', text: 'parked idea', date: null }),
            someDayGroupId: 'g1',
        },
        makeTask({ id: 't2', text: 'unlisted idea', date: null }),
    ],
    someDayGroups: [
        {
            id: 'g1',
            name: 'Work',
            description: null,
            tag: '#work',
            position: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
        },
    ],
    projects: [],
    recurringTasks: [],
    userPreferences: roundTrippable.userPreferences,
};

test('restores a version-1 snapshot by mapping it forward', () => {
    const parsed = adapter.import(JSON.stringify(v1Snapshot));
    expect(parsed.version).toBe(2);
    // Groups become lists under one default tab, ids preserved.
    expect(parsed.somedayLists).toEqual([
        {
            id: 'g1',
            tabId: 'default',
            name: 'Work',
            position: 0,
            createdAt: '2026-01-01T00:00:00.000Z',
        },
    ]);
    expect(parsed.somedayTabs).toEqual([
        {
            id: 'default',
            name: 'Someday',
            position: 0,
            projectTag: null,
            createdAt: '2026-01-15T12:00:00.000Z',
        },
    ]);
    // Task someDayGroupId reads as somedayListId.
    expect(parsed.tasks[0]?.somedayListId).toBe('g1');
    expect(parsed.tasks[1]?.somedayListId).toBeNull();
});

test('rejects a v1 snapshot whose group ids collide after mapping', () => {
    const bad = {
        ...v1Snapshot,
        someDayGroups: [
            {
                id: 'g1',
                name: 'A',
                tag: '#a',
                position: 0,
                createdAt: '2026-01-01T00:00:00.000Z',
                description: null,
            },
            {
                id: 'g1',
                name: 'B',
                tag: '#b',
                position: 1,
                createdAt: '2026-01-01T00:00:00.000Z',
                description: null,
            },
        ],
    };
    expect(() => adapter.import(JSON.stringify(bad))).toThrow(/duplicate somedayList ids/);
});

test('rejects a v1 snapshot missing someDayGroups', () => {
    const bad = { ...v1Snapshot } as Record<string, unknown>;
    delete bad.someDayGroups;
    expect(() => adapter.import(JSON.stringify(bad))).toThrow(/someDayGroups must be an array/);
});

test('rejects version 3 (unreleased future version)', () => {
    const future = { ...roundTrippable, version: 3 };
    expect(() => adapter.import(JSON.stringify(future))).toThrow(/Unsupported export version: 3/);
});

test('rejects a v2 snapshot whose list points at a missing tab', () => {
    const bad = makeSnapshot({
        somedayTabs: [],
        somedayLists: [
            {
                id: 'l1',
                tabId: 'missing-tab',
                name: 'Work',
                position: 0,
                createdAt: '2026-01-01T00:00:00.000Z',
            },
        ],
    });
    expect(() => adapter.import(JSON.stringify(bad))).toThrow(/tabId missing-tab/);
});
