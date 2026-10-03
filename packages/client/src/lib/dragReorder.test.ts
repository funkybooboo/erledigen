import { describe, expect, test } from 'bun:test';
import type { Task } from '@erledigen/shared';
import {
    byPositionThenCreated,
    planDrop,
    positionPatches,
    snapInsertBeforeId,
} from './dragReorder';

/** Minimal task factory: id + position are all the reorder logic reads. */
function task(id: string, position: number | null, createdAt = '2026-01-01T00:00:00Z'): Task {
    return {
        id,
        text: id,
        notes: null,
        completed: false,
        date: '2026-10-03',
        tags: [],
        createdAt,
        updatedAt: createdAt,
        parentId: null,
        rolloverEnabled: true,
        someDayGroupId: null,
        position,
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
    };
}

describe('byPositionThenCreated', () => {
    test('orders by position, unplaced (null) sinks to the end', () => {
        const a = task('a', 2);
        const b = task('b', null);
        const c = task('c', 1);
        expect([a, b, c].sort(byPositionThenCreated).map(t => t.id)).toEqual(['c', 'a', 'b']);
    });

    test('equal positions fall back to createdAt', () => {
        const a = task('a', null, '2026-01-02T00:00:00Z');
        const b = task('b', null, '2026-01-01T00:00:00Z');
        expect([a, b].sort(byPositionThenCreated).map(t => t.id)).toEqual(['b', 'a']);
    });
});

describe('snapInsertBeforeId', () => {
    test('top-level target stays put', () => {
        const list = [task('a', 0), task('b', 1)];
        expect(snapInsertBeforeId(list, 'b')).toBe('b');
        expect(snapInsertBeforeId(list, null)).toBeNull();
    });

    test('a sub-task target snaps past the parent block', () => {
        const parent = task('p', 0);
        const c1 = { ...task('c1', 1), parentId: 'p' };
        const c2 = { ...task('c2', 2), parentId: 'p' };
        const after = task('x', 3);
        // Hovering "before c1" effectively inserts after the block.
        expect(snapInsertBeforeId([parent, c1, c2, after], 'c1')).toBe('x');
        expect(snapInsertBeforeId([parent, c1, c2, after], 'c2')).toBe('x');
        // Block at the end -> insertion at the end.
        expect(snapInsertBeforeId([after, parent, c1], 'c1')).toBeNull();
    });

    test('unknown id behaves like the end of the list', () => {
        expect(snapInsertBeforeId([task('a', 0)], 'zzz')).toBeNull();
    });
});

describe('planDrop', () => {
    const zone = [task('a', 0), task('b', 1), task('c', 2)];

    test('dragged task already in the zone reorders', () => {
        expect(planDrop(zone, task('a', 0), null)?.map(t => t.id)).toEqual(['b', 'c', 'a']);
    });

    test('move to the middle', () => {
        expect(planDrop(zone, task('c', 2), 'b')?.map(t => t.id)).toEqual(['a', 'c', 'b']);
    });

    test('no-op when already in place', () => {
        expect(planDrop(zone, task('a', 0), 'b')).toBeNull();
        expect(planDrop(zone, task('c', 2), null)).toBeNull();
        expect(planDrop(zone, task('a', 0), 'a')).toBeNull();
    });

    test('task from another zone inserts at the snapped slot', () => {
        const foreign = task('x', 7);
        expect(planDrop(zone, foreign, 'b')?.map(t => t.id)).toEqual(['a', 'x', 'b', 'c']);
        expect(planDrop(zone, foreign, null)?.map(t => t.id)).toEqual(['a', 'b', 'c', 'x']);
        // A sub-task target snaps past the parent block.
        const parent = task('p', 0);
        const c1 = { ...task('c1', 1), parentId: 'p' };
        expect(planDrop([parent, c1], foreign, 'c1')?.map(t => t.id)).toEqual(['p', 'c1', 'x']);
    });

    test('sub-task insertion point snaps outside the block', () => {
        const parent = task('p', 0);
        const c1 = { ...task('c1', 1), parentId: 'p' };
        const moved = task('x', 2);
        const result = planDrop([parent, c1, moved], moved, 'c1');
        // x is asked to sit before c1; the block wins, so no move happens.
        expect(result).toBeNull();
    });
});

describe('positionPatches', () => {
    test('patches only tasks whose position differs from their index', () => {
        const list = [task('a', 1), task('b', 0), task('c', null)];
        expect(positionPatches(list)).toEqual([
            { id: 'a', position: 0 },
            { id: 'b', position: 1 },
            { id: 'c', position: 2 },
        ]);
    });

    test('dense order patches nothing', () => {
        const list = [task('a', 0), task('b', 1)];
        expect(positionPatches(list)).toEqual([]);
    });
});
