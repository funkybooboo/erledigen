import { describe, expect, it } from 'bun:test';
import type { CreateTaskInput, RecurringTask, Task } from '@erledigen/shared';
import { NotFoundError } from '@erledigen/shared';
import { RecurringTaskService } from './RecurringTaskService';

// Minimal fakes — just the methods the service calls. The real
// InMemoryTaskRepository/RecurringTaskRepository have their own test files.

class FakeTaskRepository {
    tasks: Task[] = [];
    counter = 0;
    create(input: CreateTaskInput): Promise<Task> {
        const now = '2026-01-01T00:00:00.000Z';
        const task: Task = {
            id: `t-${++this.counter}`,
            text: input.text,
            notes: input.notes ?? null,
            completed: false,
            date: input.date,
            createdAt: now,
            updatedAt: now,
            tags: input.tags ?? [],
            parentId: input.parentId ?? null,
            rolloverEnabled: input.rolloverEnabled ?? false,
            someDayGroupId: input.someDayGroupId ?? null,
            position: input.position ?? null,
            state: input.state ?? null,
            recurringTaskId: input.recurringTaskId ?? null,
            instanceDate: input.instanceDate ?? null,
            originalScheduledDate: null,
            daysLate: 0,
            dependsOn: null,
            startTime: input.startTime ?? null,
            endTime: input.endTime ?? null,
            reminder: input.reminder ?? null,
            deletedAt: null,
        };
        this.tasks.push(task);
        return Promise.resolve(task);
    }
    findByRecurringTaskId(recurringTaskId: string): Promise<Task[]> {
        return Promise.resolve(this.tasks.filter(t => t.recurringTaskId === recurringTaskId));
    }
}

class FakeRecurringTaskRepository {
    store = new Map<string, RecurringTask>();
    findById(id: string): Promise<RecurringTask | null> {
        return Promise.resolve(this.store.get(id) ?? null);
    }
    findAll(): Promise<RecurringTask[]> {
        return Promise.resolve(Array.from(this.store.values()));
    }
}

function makeRecurringTask(overrides: Partial<RecurringTask> = {}): RecurringTask {
    return {
        id: 'rt-1',
        text: 'Standup',
        notes: null,
        tags: ['#work'],
        frequency: 'daily',
        interval: 1,
        dayOfWeek: null,
        dayOfMonth: null,
        startDate: '2026-01-01',
        endDate: null,
        rolloverEnabled: true,
        startTime: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        ...overrides,
    };
}

describe('RecurringTaskService', () => {
    describe('generateInstances', () => {
        it('links each generated task back to the template via recurringTaskId', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const rt = makeRecurringTask({ id: 'rt-9' });
            recurringRepo.store.set(rt.id, rt);

            const service = new RecurringTaskService(recurringRepo as never, taskRepo as never);

            const created = await service.generateInstances(rt.id, '2026-03-02', '2026-03-04');
            expect(created).toHaveLength(3);
            for (const task of created) {
                expect(task.recurringTaskId).toBe(rt.id);
                expect(task.instanceDate).toBe(task.date);
            }
        });

        it('copies the template text, tags, notes, and rolloverEnabled', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const rt = makeRecurringTask({
                id: 'rt-1',
                text: 'Quiz',
                notes: 'bring pen',
                tags: ['#school'],
                rolloverEnabled: false,
            });
            recurringRepo.store.set(rt.id, rt);

            const service = new RecurringTaskService(recurringRepo as never, taskRepo as never);

            const created = await service.generateInstances(rt.id, '2026-04-01', '2026-04-01');
            expect(created).toHaveLength(1);
            for (const task of created) {
                expect(task.text).toBe('Quiz');
                expect(task.notes).toBe('bring pen');
                expect(task.tags).toEqual(['#school']);
                expect(task.rolloverEnabled).toBe(false);
            }
        });

        it('throws NotFoundError when the template does not exist', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const service = new RecurringTaskService(recurringRepo as never, taskRepo as never);

            await expect(
                service.generateInstances('missing', '2026-03-02', '2026-03-04'),
            ).rejects.toThrow(NotFoundError);
        });

        it('stamps the template startTime onto every instance', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const rt = makeRecurringTask({ id: 'rt-t', startTime: '16:00' });
            recurringRepo.store.set(rt.id, rt);

            const service = new RecurringTaskService(recurringRepo as never, taskRepo as never);

            const created = await service.generateInstances(rt.id, '2026-03-02', '2026-03-03');
            expect(created).toHaveLength(2);
            for (const task of created) {
                expect(task.startTime).toBe('16:00');
            }
        });

        it('is idempotent — overlapping ranges never duplicate instances', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const rt = makeRecurringTask({ id: 'rt-i' });
            recurringRepo.store.set(rt.id, rt);

            const service = new RecurringTaskService(recurringRepo as never, taskRepo as never);

            await service.generateInstances(rt.id, '2026-03-02', '2026-03-04');
            const second = await service.generateInstances(rt.id, '2026-03-03', '2026-03-05');

            // Only the newly-covered date (03-05) creates an instance.
            expect(second.map(t => t.date)).toEqual(['2026-03-05']);
            expect(taskRepo.tasks).toHaveLength(4); // 02, 03, 04, 05 — no dupes
        });

        it('skips completed instances too when regenerating', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const rt = makeRecurringTask({ id: 'rt-c' });
            recurringRepo.store.set(rt.id, rt);

            const service = new RecurringTaskService(recurringRepo as never, taskRepo as never);

            const first = await service.generateInstances(rt.id, '2026-03-02', '2026-03-02');
            const instance = first[0];
            if (instance) instance.completed = true;

            const second = await service.generateInstances(rt.id, '2026-03-02', '2026-03-02');
            expect(second).toHaveLength(0);
        });
    });

    describe('generateAllInstances', () => {
        it('generates for every template and only reports templates with new instances', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const daily = makeRecurringTask({ id: 'rt-daily' });
            const weekly = makeRecurringTask({
                id: 'rt-weekly',
                frequency: 'weekly',
                dayOfWeek: 2,
                startDate: '2026-03-01',
            });
            recurringRepo.store.set(daily.id, daily);
            recurringRepo.store.set(weekly.id, weekly);

            const service = new RecurringTaskService(recurringRepo as never, taskRepo as never);

            const results = await service.generateAllInstances('2026-03-02', '2026-03-08');
            // 03-02..03-08: daily creates 7, weekly-on-Tuesday creates 1 (03-03).
            const byId = new Map(results.map(r => [r.recurringTaskId, r.tasks.length]));
            expect(byId.get('rt-daily')).toBe(7);
            expect(byId.get('rt-weekly')).toBe(1);
        });

        it('returns an empty array when there are no templates', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const service = new RecurringTaskService(recurringRepo as never, taskRepo as never);

            const results = await service.generateAllInstances('2026-03-02', '2026-03-08');
            expect(results).toEqual([]);
        });
    });
});
