import { describe, expect, test } from 'bun:test';
import type { Holiday, RecurringTask, Task } from '@erledigen/shared';
import {
    findActiveStreaks,
    findOverdueTasks,
    findUpcomingDeadlineTasks,
    findUpcomingHolidays,
    SUMMARY_WINDOW_DAYS,
} from './summary';

const today = '2026-10-04';

const baseTask: Task = {
    id: '1',
    text: 'Test task',
    notes: null,
    completed: false,
    date: today,
    createdAt: '2026-10-04T09:00:00Z',
    updatedAt: '2026-10-04T09:00:00Z',
    tags: [],
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

function task(overrides: Partial<Task> & Pick<Task, 'id' | 'text'>): Task {
    return { ...baseTask, ...overrides };
}

const baseHoliday: Holiday = {
    id: 'h1',
    name: 'Test holiday',
    date: today,
    createdAt: '2026-10-04T09:00:00Z',
};

function holiday(overrides: Partial<Holiday> & Pick<Holiday, 'id' | 'name'>): Holiday {
    return { ...baseHoliday, ...overrides };
}

const baseHabit: RecurringTask = {
    id: 'r1',
    text: 'Test habit',
    notes: null,
    tags: [],
    frequency: 'daily',
    interval: 1,
    daysOfWeek: null,
    dayOfMonth: null,
    startDate: '2026-01-01',
    endDate: null,
    rolloverEnabled: true,
    startTime: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
};

describe('findOverdueTasks', () => {
    test('includes only incomplete tasks scheduled before today', () => {
        const overdue = task({ id: 'a', text: 'Old', date: '2026-10-01' });
        const complete = task({ id: 'b', text: 'Done old', date: '2026-10-01', completed: true });
        const someday = task({ id: 'c', text: 'Someday', date: null });
        const upcoming = task({ id: 'd', text: 'Soon', date: '2026-10-10' });

        const result = findOverdueTasks([overdue, complete, someday, upcoming], today);
        expect(result.map(o => o.task.id)).toEqual(['a']);
        expect(result[0]?.daysLate).toBe(3);
    });

    test('sorts most overdue first', () => {
        const three = task({ id: 'a', text: 'Three days', date: '2026-10-01' });
        const one = task({ id: 'b', text: 'One day', date: '2026-10-03' });
        const result = findOverdueTasks([three, one], today);
        expect(result.map(o => o.task.id)).toEqual(['a', 'b']);
        expect(result.map(o => o.daysLate)).toEqual([3, 1]);
    });

    test('sub-tasks count as overdue entries of their own', () => {
        const sub = task({ id: 's', text: 'Child', date: '2026-10-02', parentId: 'p' });
        expect(findOverdueTasks([sub], today).map(o => o.task.id)).toEqual(['s']);
    });
});

describe('findUpcomingDeadlineTasks', () => {
    test('includes #deadline tasks within the window, soonest first', () => {
        const near = task({ id: 'a', text: 'Soon', date: '2026-10-06', tags: ['deadline'] });
        const nearer = task({ id: 'b', text: 'Sooner', date: '2026-10-05', tags: ['deadline'] });

        const result = findUpcomingDeadlineTasks([near, nearer], today);
        expect(result.map(t => t.id)).toEqual(['b', 'a']);
    });

    test(`excludes deadlines outside ${SUMMARY_WINDOW_DAYS} days, today-boundary included`, () => {
        const atEnd = task({
            id: 'end',
            text: 'Window edge',
            date: '2026-10-18',
            tags: ['deadline'],
        }); // today + 14 = inclusive edge
        const past = task({ id: 'past', text: 'Past', date: '2026-09-01', tags: ['deadline'] });
        const far = task({ id: 'far', text: 'Far', date: '2026-10-19', tags: ['deadline'] });

        expect(findUpcomingDeadlineTasks([atEnd, past, far], today).map(t => t.id)).toEqual([
            'end',
        ]);
    });

    test('excludes untagged tasks and deadline tasks without a date', () => {
        const plain = task({ id: 'a', text: 'Plain', date: '2026-10-05' });
        const undated = task({ id: 'b', text: 'Undated', date: null, tags: ['deadline'] });
        expect(findUpcomingDeadlineTasks([plain, undated], today)).toEqual([]);
    });

    test('excludes completed deadline tasks', () => {
        const done = task({
            id: 'a',
            text: 'Done',
            date: '2026-10-05',
            tags: ['deadline'],
            completed: true,
        });
        expect(findUpcomingDeadlineTasks([done], today)).toEqual([]);
    });
});

describe('findUpcomingHolidays', () => {
    test('includes holidays in the window, soonest first', () => {
        const inWindow = holiday({ id: 'a', name: 'In', date: '2026-10-10' });
        const earlier = holiday({ id: 'b', name: 'Earlier', date: '2026-10-05' });
        const past = holiday({ id: 'c', name: 'Past', date: '2026-09-01' });
        const far = holiday({ id: 'd', name: 'Far', date: '2026-11-01' });
        const todayEdge = holiday({ id: 'e', name: 'Today', date: today });

        const result = findUpcomingHolidays([inWindow, earlier, past, far, todayEdge], today);
        expect(result.map(h => h.id)).toEqual(['e', 'b', 'a']);
    });
});

describe('findActiveStreaks', () => {
    test('lists habits with a current streak, longest first', () => {
        const a = { ...baseHabit, id: 'a', text: 'Alpha' };
        const b = { ...baseHabit, id: 'b', text: 'Beta' };
        const c = { ...baseHabit, id: 'c', text: 'Gamma' };
        const stats = new Map<string, { currentStreak: number }>([
            ['a', { currentStreak: 2 }],
            ['b', { currentStreak: 7 }],
            ['c', { currentStreak: 0 }],
        ]);

        const result = findActiveStreaks([a, b, c], stats);
        expect(result.map(s => s.habit.id)).toEqual(['b', 'a']);
        expect(result.map(s => s.currentStreak)).toEqual([7, 2]);
    });

    test('skips habits without a stats entry', () => {
        const a = { ...baseHabit, id: 'a' };
        const stats = new Map<string, { currentStreak: number }>();
        expect(findActiveStreaks([a], stats)).toEqual([]);
    });

    test('breaks streak ties by habit name', () => {
        const z = { ...baseHabit, id: 'z', text: 'Zulu' };
        const y = { ...baseHabit, id: 'y', text: 'Yankee' };
        const stats = new Map<string, { currentStreak: number }>([
            ['z', { currentStreak: 3 }],
            ['y', { currentStreak: 3 }],
        ]);
        expect(findActiveStreaks([z, y], stats).map(s => s.habit.text)).toEqual(['Yankee', 'Zulu']);
    });
});
