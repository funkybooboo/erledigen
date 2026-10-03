import { describe, expect, test } from 'bun:test';
import type { Task } from '../types/task';
import {
    DEFAULT_DISTRIBUTION_SPAN_DAYS,
    distributionEligibleTasks,
    distributionWindowStart,
    planProjectDistribution,
} from './projectDistribution';

const today = '2026-10-04';

const baseTask: Task = {
    id: '1',
    text: 'Task',
    notes: null,
    completed: false,
    date: null,
    createdAt: '2026-10-04T09:00:00Z',
    updatedAt: '2026-10-04T09:00:00Z',
    tags: ['project:x'],
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
};

function task(overrides: Partial<Task> & Pick<Task, 'id' | 'text'>): Task {
    return { ...baseTask, ...overrides };
}

describe('distributionEligibleTasks', () => {
    test('keeps only top-level, incomplete, unscheduled tasks', () => {
        const ready = task({ id: 'a', text: 'Ready' });
        const scheduled = task({ id: 'b', text: 'Scheduled', date: '2026-10-10' });
        const done = task({ id: 'c', text: 'Done', completed: true });
        const sub = task({ id: 'd', text: 'Sub', parentId: 'a' });

        expect(distributionEligibleTasks([ready, scheduled, done, sub]).map(t => t.id)).toEqual([
            'a',
        ]);
    });
});

describe('planProjectDistribution', () => {
    test('spreads tasks round-robin across the project window', () => {
        const tasks = [
            task({ id: 'a', text: 'A' }),
            task({ id: 'b', text: 'B' }),
            task({ id: 'c', text: 'C' }),
        ];
        const plan = planProjectDistribution(tasks, {
            startDate: '2026-10-05',
            dueDate: '2026-10-07',
            today,
        });
        expect(plan).toEqual([
            { taskId: 'a', date: '2026-10-05' },
            { taskId: 'b', date: '2026-10-06' },
            { taskId: 'c', date: '2026-10-07' },
        ]);
    });

    test('wraps when there are more tasks than days', () => {
        const tasks = [
            task({ id: 'a', text: 'A' }),
            task({ id: 'b', text: 'B' }),
            task({ id: 'c', text: 'C' }),
            task({ id: 'd', text: 'D' }),
        ];
        const plan = planProjectDistribution(tasks, {
            startDate: '2026-10-05',
            dueDate: '2026-10-06',
            today,
        });
        expect(plan.map(p => p.date)).toEqual([
            '2026-10-05',
            '2026-10-06',
            '2026-10-05',
            '2026-10-06',
        ]);
    });

    test('never starts before today, even with a past start date', () => {
        const plan = planProjectDistribution([task({ id: 'a', text: 'A' })], {
            startDate: '2026-09-01',
            dueDate: '2026-10-06',
            today,
        });
        expect(plan).toEqual([{ taskId: 'a', date: today }]);
    });

    test('a due date already in the past plans nothing', () => {
        const plan = planProjectDistribution([task({ id: 'a', text: 'A' })], {
            startDate: '2026-09-01',
            dueDate: '2026-09-30',
            today,
        });
        expect(plan).toEqual([]);
    });

    test(`without a due date the window spans ${DEFAULT_DISTRIBUTION_SPAN_DAYS} days`, () => {
        const tasks = [task({ id: 'a', text: 'A' }), task({ id: 'b', text: 'B' })];
        const plan = planProjectDistribution(tasks, {
            startDate: null,
            dueDate: null,
            today,
        });
        expect(plan).toEqual([
            { taskId: 'a', date: today },
            { taskId: 'b', date: '2026-10-05' },
        ]);
    });

    test('schedules a blocked task after its blocker', () => {
        // Document order B, A; A blocks B -> A distributes first.
        const tasks = [task({ id: 'b', text: 'B', dependsOn: 'a' }), task({ id: 'a', text: 'A' })];
        const plan = planProjectDistribution(tasks, {
            startDate: '2026-10-05',
            dueDate: '2026-10-06',
            today,
        });
        expect(plan).toEqual([
            { taskId: 'a', date: '2026-10-05' },
            { taskId: 'b', date: '2026-10-06' },
        ]);
    });

    test('dependencies chain through the eligible set', () => {
        const tasks = [
            task({ id: 'c', text: 'C', dependsOn: 'b' }),
            task({ id: 'b', text: 'B', dependsOn: 'a' }),
            task({ id: 'a', text: 'A' }),
        ];
        const plan = planProjectDistribution(tasks, {
            startDate: '2026-10-05',
            dueDate: '2026-10-07',
            today,
        });
        expect(plan.map(p => p.taskId)).toEqual(['a', 'b', 'c']);
    });

    test('a dependsOn outside the eligible set imposes no order', () => {
        // The blocker is scheduled already -- nothing to wait for in-plan.
        const tasks = [task({ id: 'b', text: 'B', dependsOn: 'z' }), task({ id: 'a', text: 'A' })];
        const plan = planProjectDistribution(tasks, {
            startDate: '2026-10-05',
            dueDate: '2026-10-06',
            today,
        });
        expect(plan.map(p => p.taskId)).toEqual(['b', 'a']);
    });

    test('dependency cycles fall back to document order instead of hanging', () => {
        const tasks = [
            task({ id: 'a', text: 'A', dependsOn: 'b' }),
            task({ id: 'b', text: 'B', dependsOn: 'a' }),
        ];
        const plan = planProjectDistribution(tasks, {
            startDate: '2026-10-05',
            dueDate: '2026-10-06',
            today,
        });
        expect(plan.map(p => p.taskId)).toEqual(['a', 'b']);
    });

    test('schedules only the eligible tasks', () => {
        const tasks = [
            task({ id: 'a', text: 'Ready' }),
            task({ id: 'b', text: 'Scheduled', date: '2026-10-10' }),
        ];
        const plan = planProjectDistribution(tasks, {
            startDate: '2026-10-05',
            dueDate: '2026-10-06',
            today,
        });
        expect(plan.map(p => p.taskId)).toEqual(['a']);
    });
});

describe('distributionWindowStart', () => {
    test('prefers the project start date when it is in the future', () => {
        expect(distributionWindowStart({ startDate: '2026-11-01', dueDate: null, today })).toBe(
            '2026-11-01',
        );
    });

    test('falls back to today for a past or missing start date', () => {
        expect(distributionWindowStart({ startDate: '2026-09-01', dueDate: null, today })).toBe(
            today,
        );
        expect(distributionWindowStart({ startDate: null, dueDate: null, today })).toBe(today);
    });
});
