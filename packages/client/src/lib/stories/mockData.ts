import type { Task } from '@erledigen/shared';

export const mockTask: Task = {
    id: '1',
    text: 'Buy groceries',
    notes: null,
    completed: false,
    date: '2026-04-27',
    createdAt: '2026-04-27T09:00:00Z',
    updatedAt: '2026-04-27T09:00:00Z',
    tags: ['work'],
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

export const mockCompletedTask: Task = {
    ...mockTask,
    id: '2',
    text: 'Write documentation',
    completed: true,
    tags: ['p1'],
};

export const mockOverdueTask: Task = {
    ...mockTask,
    id: '3',
    text: 'Submit report',
    date: '2026-04-25',
    daysLate: 2,
    tags: ['work', 'deadline'],
};

export const mockSubTask: Task = {
    ...mockTask,
    id: '4',
    text: 'Research prices',
    parentId: '1',
    tags: [],
};

export const mockTimeTask: Task = {
    ...mockTask,
    id: '5',
    text: 'Team standup',
    startTime: '09:00',
    endTime: '09:30',
    tags: ['meeting'],
};

export const mockRecurringTaskInstance: Task = {
    ...mockTask,
    id: '6',
    text: 'Morning exercise',
    recurringTaskId: 'rt-1',
    tags: ['health'],
};

export const mockPriorityTask: Task = {
    ...mockTask,
    id: '7',
    text: 'Fix critical bug',
    tags: ['p1', 'urgent'],
};

export const mockTasks: Task[] = [
    mockTask,
    mockCompletedTask,
    {
        ...mockTask,
        id: '8',
        text: 'Read a book',
        date: '2026-04-28',
        tags: ['reading'],
    },
];
