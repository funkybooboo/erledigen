import { describe, expect, test } from 'bun:test';
import type { ActiveFilters, Task } from '@erledigen/shared';
import { applyFilters, sortTasksForView } from './filters';

const baseTask: Task = {
    id: '1',
    text: 'Test task',
    notes: null,
    completed: false,
    date: '2026-01-15',
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-01-15T09:00:00Z',
    tags: ['work', 'p1'],
    parentId: null,
    rolloverEnabled: true,
    someDayGroupId: null,
    position: 0,
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

const noFilters: ActiveFilters = {
    tags: [],
    showCompleted: true,
    sortMode: 'manual',
    dateFrom: null,
    dateTo: null,
};

describe('applyFilters', () => {
    test('returns all tasks when no filters are active', () => {
        const tasks = [baseTask];
        const result = applyFilters(tasks, noFilters);
        expect(result).toHaveLength(1);
    });

    test('filters by tag', () => {
        const tasks = [baseTask];
        const filters: ActiveFilters = { ...noFilters, tags: ['work'] };
        const result = applyFilters(tasks, filters);
        expect(result).toHaveLength(1);
    });

    test('excludes tasks that do not match tag filter', () => {
        const tasks = [baseTask];
        const filters: ActiveFilters = { ...noFilters, tags: ['home'] };
        const result = applyFilters(tasks, filters);
        expect(result).toHaveLength(0);
    });

    test('filters by project tag', () => {
        const projectTask = { ...baseTask, tags: ['work', 'p1', 'project:build-erledigen'] };
        const tasks = [projectTask];
        const filters: ActiveFilters = { ...noFilters, tags: ['project:build-erledigen'] };
        const result = applyFilters(tasks, filters);
        expect(result).toHaveLength(1);
    });

    test('excludes tasks without the project tag', () => {
        const tasks = [baseTask];
        const filters: ActiveFilters = { ...noFilters, tags: ['project:build-erledigen'] };
        const result = applyFilters(tasks, filters);
        expect(result).toHaveLength(0);
    });

    test('filters by priority tag (p1)', () => {
        const tasks = [baseTask];
        const filters: ActiveFilters = { ...noFilters, tags: ['p1'] };
        const result = applyFilters(tasks, filters);
        expect(result).toHaveLength(1);
    });

    test('excludes tasks without the priority tag', () => {
        const taskNoPriority = { ...baseTask, tags: ['work'] };
        const tasks = [taskNoPriority];
        const filters: ActiveFilters = { ...noFilters, tags: ['p1'] };
        const result = applyFilters(tasks, filters);
        expect(result).toHaveLength(0);
    });

    test('never hides completed tasks (showCompleted is ignored)', () => {
        const completedTask = { ...baseTask, completed: true };
        const tasks = [baseTask, completedTask];
        const filters: ActiveFilters = { ...noFilters, showCompleted: false };
        const result = applyFilters(tasks, filters);
        // Completed tasks always stay visible -- nothing is hidden in the UI.
        expect(result).toHaveLength(2);
    });

    test('applies multiple tag filters together (OR logic)', () => {
        const task1 = baseTask;
        const task2 = { ...baseTask, id: '2', tags: ['work'] };
        const task3 = { ...baseTask, id: '3', tags: ['home'] };
        const tasks = [task1, task2, task3];
        const filters: ActiveFilters = { ...noFilters, tags: ['work'] };
        const result = applyFilters(tasks, filters);
        expect(result).toHaveLength(2);
        expect(result.every(t => t.tags.includes('work'))).toBe(true);
    });
});

describe('applyFilters -- date range', () => {
    const today = { ...baseTask, id: 'a', date: '2026-10-01' };
    const soon = { ...baseTask, id: 'b', date: '2026-10-05' };
    const far = { ...baseTask, id: 'c', date: '2026-10-20' };
    const someday = { ...baseTask, id: 'd', date: null };

    test('hides tasks outside the inclusive range', () => {
        const filters: ActiveFilters = {
            ...noFilters,
            dateFrom: '2026-10-01',
            dateTo: '2026-10-07',
        };
        const result = applyFilters([today, soon, far], filters);
        expect(result.map(t => t.id)).toEqual(['a', 'b']);
    });

    test('an open-ended range bounds only one side', () => {
        const fromOnly: ActiveFilters = { ...noFilters, dateFrom: '2026-10-10' };
        expect(applyFilters([today, far], fromOnly).map(t => t.id)).toEqual(['c']);

        const toOnly: ActiveFilters = { ...noFilters, dateTo: '2026-10-10' };
        expect(applyFilters([today, far], toOnly).map(t => t.id)).toEqual(['a']);
    });

    test('the range never hides date-less (Someday) tasks', () => {
        const filters: ActiveFilters = {
            ...noFilters,
            dateFrom: '2026-10-01',
            dateTo: '2026-10-07',
        };
        const result = applyFilters([today, someday], filters);
        expect(result.map(t => t.id)).toEqual(['a', 'd']);
    });
});

describe('sortTasksForView', () => {
    const plain = { ...baseTask, id: 'plain', tags: ['work'] };
    const p1 = { ...baseTask, id: 'p1', tags: ['p1'] };
    const p2 = { ...baseTask, id: 'p2', tags: ['p2'] };
    const p3 = { ...baseTask, id: 'p3', tags: ['p3'] };

    test('manual mode returns the input order untouched', () => {
        const tasks = [p3, plain, p1];
        expect(sortTasksForView(tasks, 'manual')).toEqual(tasks);
        // And the array itself is not mutated.
        expect(tasks[0]?.id).toBe('p3');
    });

    test('priority mode orders p1 -> p2 -> p3 -> untagged', () => {
        const tasks = [plain, p3, p1, p2];
        expect(sortTasksForView(tasks, 'priority').map(t => t.id)).toEqual([
            'p1',
            'p2',
            'p3',
            'plain',
        ]);
    });

    test('priority mode is stable within the same rank', () => {
        const first = { ...baseTask, id: 'first', tags: [] };
        const second = { ...baseTask, id: 'second', tags: [] };
        expect(sortTasksForView([second, first, p1], 'priority').map(t => t.id)).toEqual([
            'p1',
            'second',
            'first',
        ]);
    });
});

describe('sortTasksForView -- sub-task blocks', () => {
    const p1Parent = { ...baseTask, id: 'p1parent', tags: ['p1'] };
    const child = { ...baseTask, id: 'child', parentId: 'p1parent', tags: ['p3'] };
    const plainParent = { ...baseTask, id: 'plainParent', tags: ['work'] };
    const child2 = { ...baseTask, id: 'child2', parentId: 'plainParent', tags: [] };

    test('children stay attached to their parent under priority sort', () => {
        const tasks = [plainParent, child2, p1Parent, child];
        expect(sortTasksForView(tasks, 'priority').map(t => t.id)).toEqual([
            'p1parent',
            'child',
            'plainParent',
            'child2',
        ]);
    });
});
