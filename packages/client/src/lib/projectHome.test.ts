import { describe, expect, test } from 'bun:test';
import type {
    Project,
    RecurringTask,
    RecurringTaskStats,
    SomedayList,
    Task,
} from '@erledigen/shared';
import { DONE_RECENT_LIMIT, gatherProjectHome } from './projectHome';

const project: Project = {
    id: 'p1',
    name: 'Build house',
    tag: 'project:build-house',
    description: null,
    startDate: null,
    dueDate: null,
    hillPosition: 0,
    createdAt: '2026-01-01T00:00:00Z',
    completedAt: null,
};

const TAG = 'project:build-house';

const task = (overrides: Partial<Task> & Pick<Task, 'id' | 'text'>): Task => ({
    notes: null,
    completed: false,
    date: '2026-03-01',
    createdAt: '2026-01-10T09:00:00Z',
    updatedAt: '2026-01-10T09:00:00Z',
    tags: [TAG],
    parentId: null,
    rolloverEnabled: true,
    somedayListId: null,
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
});

const list = (id: string, name: string, position: number): SomedayList => ({
    id,
    tabId: 'default',
    name,
    position,
    createdAt: '2026-01-01T00:00:00Z',
});

const stats = new Map<string, RecurringTaskStats>();

const home = gatherProjectHome.bind(null, project);

describe('gatherProjectHome', () => {
    test('gathers only tasks wearing the project tag', () => {
        const result = home([task({ id: '1', text: 'member', date: null })], [], [], new Map());
        expect(result.doneCount).toBe(0);

        const foreign = home(
            [task({ id: '2', text: 'not mine', tags: ['other'], date: null })],
            [],
            [],
            new Map(),
        );
        expect(foreign.backlog).toEqual([]);
    });

    test('backlog: undated incomplete tasks group by their list, lists ordered by position, Unlisted last', () => {
        const result = home(
            [
                task({ id: 'a', text: 'A', date: null, somedayListId: 'l2', position: 1 }),
                task({ id: 'b', text: 'B', date: null, somedayListId: 'l1', position: 0 }),
                task({ id: 'c', text: 'C', date: null, somedayListId: null }),
            ],
            [list('l2', 'Later', 1), list('l1', 'First', 0)],
            [],
            new Map(),
        );
        expect(result.backlog.map(g => g.listName)).toEqual(['First', 'Later', '']);
        expect(result.backlog[0]?.tasks.map(t => t.id)).toEqual(['b']);
        expect(result.backlog[2]?.tasks.map(t => t.id)).toEqual(['c']);
    });

    test('backlog: sub-tasks ride along under their parent even without the tag', () => {
        const result = home(
            [
                task({ id: 'p', text: 'Parent', date: null, somedayListId: 'l1' }),
                task({ id: 'c', text: 'Child', tags: [], parentId: 'p', date: null }),
            ],
            [list('l1', 'First', 0)],
            [],
            new Map(),
        );
        expect(result.backlog[0]?.tasks.map(t => t.id)).toEqual(['p', 'c']);
    });

    test('scheduled: dated incomplete tasks group by day, soonest first', () => {
        const result = home(
            [
                task({ id: 'x', text: 'X', date: '2026-03-03' }),
                task({ id: 'y', text: 'Y', date: '2026-03-01' }),
                task({ id: 'z', text: 'Z', date: '2026-03-03' }),
            ],
            [],
            [],
            new Map(),
        );
        expect(result.scheduled.map(d => d.date)).toEqual(['2026-03-01', '2026-03-03']);
        expect(result.scheduled[1]?.tasks.map(t => t.id)).toEqual(['x', 'z']);
    });

    test('done: every completion counts; the section shows the most recent', () => {
        const tasks = Array.from({ length: DONE_RECENT_LIMIT + 4 }, (_, i) =>
            task({
                id: `d${i}`,
                text: `Done ${i}`,
                completed: true,
                date: null,
                updatedAt: `2026-01-${String(i + 1).padStart(2, '0')}T09:00:00Z`,
            }),
        );
        const result = home(tasks, [], [], new Map());
        expect(result.doneCount).toBe(DONE_RECENT_LIMIT + 4);
        expect(result.doneRecent.length).toBe(DONE_RECENT_LIMIT);
        // Most recent first.
        expect(result.doneRecent[0]?.id).toBe(`d${DONE_RECENT_LIMIT + 3}`);
    });

    test('routines: habits wearing the tag, with streaks', () => {
        const habit: RecurringTask = {
            id: 'r1',
            text: 'Water the site every day',
            notes: null,
            tags: [TAG],
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
        const foreign: RecurringTask = { ...habit, id: 'r2', tags: [] };
        stats.set('r1', {
            recurringTaskId: 'r1',
            currentStreak: 5,
            longestStreak: 9,
            totalCompletions: 20,
            lastCompletedDate: '2026-03-01',
        });
        const result = home([], [], [habit, foreign], stats);
        expect(result.routines.length).toBe(1);
        expect(result.routines[0]?.streak).toBe(5);
    });
});
