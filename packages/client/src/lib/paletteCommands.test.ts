import { describe, expect, it } from 'bun:test';
import type { Task } from '@erledigen/shared';
import {
    findTaskByText,
    normalizeTagInput,
    parseMoveArgs,
    parseTagArgs,
    splitOnLast,
} from './paletteCommands';

function task(overrides: Partial<Task>): Task {
    return {
        id: 't1',
        text: 'buy milk',
        notes: null,
        completed: false,
        date: '2026-10-01',
        createdAt: '2026-10-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
        tags: [],
        parentId: null,
        rolloverEnabled: true,
        someDayGroupId: null,
        position: null,
        state: null,
        recurringTaskId: null,
        instanceDate: null,
        originalScheduledDate: null,
        daysLate: 0,
        dependsOn: null,
        startTime: null,
        endTime: null,
        reminder: null,
        deletedAt: null,
        ...overrides,
    };
}

describe('findTaskByText', () => {
    const tasks = [
        task({ id: 'a', text: 'Buy milk', completed: true }),
        task({ id: 'b', text: 'buy more milk' }),
        task({ id: 'c', text: 'walk the dog' }),
    ];

    it('matches case-insensitive substrings', () => {
        expect(findTaskByText(tasks, 'MILK')?.id).toBe('b');
        expect(findTaskByText(tasks, 'dog')?.id).toBe('c');
    });

    it('prefers incomplete tasks over completed ones', () => {
        expect(findTaskByText(tasks, 'buy')?.id).toBe('b');
    });

    it('falls back to a completed match when nothing else matches', () => {
        // "buy milk" exactly matches only the completed task.
        expect(findTaskByText(tasks, 'Buy milk')?.id).toBe('a');
    });

    it('returns null for empty or unmatched queries', () => {
        expect(findTaskByText(tasks, '')).toBeNull();
        expect(findTaskByText(tasks, '   ')).toBeNull();
        expect(findTaskByText(tasks, 'wash cat')).toBeNull();
    });
});

describe('splitOnLast', () => {
    it('splits on the last separator occurrence', () => {
        expect(splitOnLast('reply to mom to friday', ' to ')).toEqual({
            left: 'reply to mom',
            right: 'friday',
        });
    });

    it('returns null when the separator is missing', () => {
        expect(splitOnLast('no separator here', ' to ')).toBeNull();
    });

    it('returns null when either side is empty', () => {
        expect(splitOnLast('to friday', ' to ')).toBeNull();
        expect(splitOnLast('friday to', ' to ')).toBeNull();
    });
});

describe('parseMoveArgs / parseTagArgs', () => {
    it('parses move text and date parts', () => {
        expect(parseMoveArgs('buy milk to next monday')).toEqual({
            text: 'buy milk',
            date: 'next monday',
        });
    });

    it('parses tag text and tag parts', () => {
        expect(parseTagArgs('buy milk with groceries')).toEqual({
            text: 'buy milk',
            tag: 'groceries',
        });
    });

    it('returns null without the separator', () => {
        expect(parseMoveArgs('buy milk')).toBeNull();
        expect(parseTagArgs('buy milk')).toBeNull();
    });
});

describe('normalizeTagInput', () => {
    it('trims, strips a leading hash, and lowercases', () => {
        expect(normalizeTagInput('  #Work ')).toBe('work');
        expect(normalizeTagInput('Work')).toBe('work');
    });

    it('leaves inner hashes alone', () => {
        expect(normalizeTagInput('a#b')).toBe('a#b');
    });

    it('returns empty for hash-only input', () => {
        expect(normalizeTagInput('#')).toBe('');
        expect(normalizeTagInput('')).toBe('');
    });
});
