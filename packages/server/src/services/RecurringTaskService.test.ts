import { describe, expect, it } from 'bun:test';
import type { CreateTaskInput, RecurringTask, RecurringTaskStats, Task } from '@erledigen/shared';
import { NotFoundError } from '@erledigen/shared';
import { RecurringTaskService } from './RecurringTaskService';

// Minimal fakes -- just the methods the service calls. The real
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
    stats = new Map<string, RecurringTaskStats>();
    upsertCount = 0;
    findById(id: string): Promise<RecurringTask | null> {
        return Promise.resolve(this.store.get(id) ?? null);
    }
    findAll(): Promise<RecurringTask[]> {
        return Promise.resolve(Array.from(this.store.values()));
    }
    findStats(recurringTaskId: string): Promise<RecurringTaskStats | null> {
        return Promise.resolve(this.stats.get(recurringTaskId) ?? null);
    }
    upsertStats(stats: RecurringTaskStats): Promise<void> {
        this.upsertCount++;
        this.stats.set(stats.recurringTaskId, stats);
        return Promise.resolve();
    }
}

/** Frozen clock so streak math is deterministic ("today" = 2026-03-15). */
class FakeDateProvider {
    today(): string {
        return '2026-03-15';
    }
    timestamp(): string {
        return '2026-03-15T00:00:00.000Z';
    }
}

function makeService(
    recurringRepo: FakeRecurringTaskRepository,
    taskRepo: FakeTaskRepository,
): RecurringTaskService {
    return new RecurringTaskService(
        recurringRepo as never,
        taskRepo as never,
        new FakeDateProvider() as never,
    );
}

function makeRecurringTask(overrides: Partial<RecurringTask> = {}): RecurringTask {
    return {
        id: 'rt-1',
        text: 'Standup',
        notes: null,
        tags: ['#work'],
        frequency: 'daily',
        interval: 1,
        daysOfWeek: null,
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

            const service = makeService(recurringRepo, taskRepo);

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

            const service = makeService(recurringRepo, taskRepo);

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
            const service = makeService(recurringRepo, taskRepo);

            await expect(
                service.generateInstances('missing', '2026-03-02', '2026-03-04'),
            ).rejects.toThrow(NotFoundError);
        });

        it('stamps the template startTime onto every instance', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const rt = makeRecurringTask({ id: 'rt-t', startTime: '16:00' });
            recurringRepo.store.set(rt.id, rt);

            const service = makeService(recurringRepo, taskRepo);

            const created = await service.generateInstances(rt.id, '2026-03-02', '2026-03-03');
            expect(created).toHaveLength(2);
            for (const task of created) {
                expect(task.startTime).toBe('16:00');
            }
        });

        it('is idempotent -- overlapping ranges never duplicate instances', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const rt = makeRecurringTask({ id: 'rt-i' });
            recurringRepo.store.set(rt.id, rt);

            const service = makeService(recurringRepo, taskRepo);

            await service.generateInstances(rt.id, '2026-03-02', '2026-03-04');
            const second = await service.generateInstances(rt.id, '2026-03-03', '2026-03-05');

            // Only the newly-covered date (03-05) creates an instance.
            expect(second.map(t => t.date)).toEqual(['2026-03-05']);
            expect(taskRepo.tasks).toHaveLength(4); // 02, 03, 04, 05 -- no dupes
        });

        it('skips completed instances too when regenerating', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const rt = makeRecurringTask({ id: 'rt-c' });
            recurringRepo.store.set(rt.id, rt);

            const service = makeService(recurringRepo, taskRepo);

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
                daysOfWeek: [2],
                startDate: '2026-03-01',
            });
            recurringRepo.store.set(daily.id, daily);
            recurringRepo.store.set(weekly.id, weekly);

            const service = makeService(recurringRepo, taskRepo);

            const results = await service.generateAllInstances('2026-03-02', '2026-03-08');
            // 03-02..03-08: daily creates 7, weekly-on-Tuesday creates 1 (03-03).
            const byId = new Map(results.map(r => [r.recurringTaskId, r.tasks.length]));
            expect(byId.get('rt-daily')).toBe(7);
            expect(byId.get('rt-weekly')).toBe(1);
        });

        it('returns an empty array when there are no templates', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const service = makeService(recurringRepo, taskRepo);

            const results = await service.generateAllInstances('2026-03-02', '2026-03-08');
            expect(results).toEqual([]);
        });
    });

    describe('computeStats', () => {
        /** Seed a completed/uncompleted instance directly (skipping generation). */
        function seed(
            taskRepo: FakeTaskRepository,
            rtId: string,
            date: string,
            completed: boolean,
        ): void {
            taskRepo.tasks.push({
                id: `t-${taskRepo.tasks.length}-${date}`,
                text: 'instance',
                notes: null,
                completed,
                date,
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-01T00:00:00.000Z',
                tags: [],
                parentId: null,
                rolloverEnabled: false,
                someDayGroupId: null,
                position: null,
                state: null,
                recurringTaskId: rtId,
                instanceDate: date,
                originalScheduledDate: null,
                daysLate: 0,
                dependsOn: null,
                startTime: null,
                endTime: null,
                reminder: null,
                deletedAt: null,
            });
        }

        it('counts a consecutive completed run as the current streak', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const rt = makeRecurringTask({ id: 'rt-s', startDate: '2026-03-10' });
            recurringRepo.store.set(rt.id, rt);
            // "Today" is 2026-03-15 (FakeDateProvider).
            seed(taskRepo, rt.id, '2026-03-12', true);
            seed(taskRepo, rt.id, '2026-03-13', true);
            seed(taskRepo, rt.id, '2026-03-14', true);

            const stats = await makeService(recurringRepo, taskRepo).computeStats(rt.id);
            expect(stats.currentStreak).toBe(3);
            expect(stats.longestStreak).toBe(3);
            expect(stats.totalCompletions).toBe(3);
            expect(stats.lastCompletedDate).toBe('2026-03-14');
            expect(recurringRepo.stats.get(rt.id)).toEqual(stats);
        });

        it('breaks the streak when the latest occurrence is uncompleted', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const rt = makeRecurringTask({ id: 'rt-s', startDate: '2026-03-10' });
            recurringRepo.store.set(rt.id, rt);
            seed(taskRepo, rt.id, '2026-03-12', true);
            seed(taskRepo, rt.id, '2026-03-13', true);
            seed(taskRepo, rt.id, '2026-03-14', false);

            const stats = await makeService(recurringRepo, taskRepo).computeStats(rt.id);
            expect(stats.currentStreak).toBe(0);
            expect(stats.longestStreak).toBe(2);
            expect(stats.totalCompletions).toBe(2);
        });

        it('breaks the streak across a missed day (gap between instances)', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const rt = makeRecurringTask({ id: 'rt-s', startDate: '2026-03-10' });
            recurringRepo.store.set(rt.id, rt);
            // 03-11 and 03-12 completed, 03-13 missing, 03-14 completed.
            seed(taskRepo, rt.id, '2026-03-11', true);
            seed(taskRepo, rt.id, '2026-03-12', true);
            seed(taskRepo, rt.id, '2026-03-14', true);

            const stats = await makeService(recurringRepo, taskRepo).computeStats(rt.id);
            expect(stats.currentStreak).toBe(1);
            expect(stats.longestStreak).toBe(2);
        });

        it('keeps weekly streaks across week gaps (adjacency, not calendar days)', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            // Every Friday, starting 2026-03-06 (a Friday).
            const rt = makeRecurringTask({
                id: 'rt-w',
                frequency: 'weekly',
                daysOfWeek: [5],
                startDate: '2026-03-06',
            });
            recurringRepo.store.set(rt.id, rt);
            seed(taskRepo, rt.id, '2026-03-06', true);
            seed(taskRepo, rt.id, '2026-03-13', true);

            const stats = await makeService(recurringRepo, taskRepo).computeStats(rt.id);
            // 7-day gap, but adjacent on the weekly schedule.
            expect(stats.currentStreak).toBe(2);
        });

        it('ignores future occurrences for streaks but counts their completions', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const rt = makeRecurringTask({ id: 'rt-f', startDate: '2026-03-10' });
            recurringRepo.store.set(rt.id, rt);
            seed(taskRepo, rt.id, '2026-03-14', true);
            // Completed "early" -- after today (2026-03-15).
            seed(taskRepo, rt.id, '2026-03-16', true);

            const stats = await makeService(recurringRepo, taskRepo).computeStats(rt.id);
            expect(stats.currentStreak).toBe(1);
            expect(stats.longestStreak).toBe(1);
            expect(stats.totalCompletions).toBe(2);
            expect(stats.lastCompletedDate).toBe('2026-03-16');
        });

        it('adjacency bridges pre-start instances after a forward startDate edit', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            // Every 3 days starting 2026-03-04, then the template's start
            // was edited forward to 2026-03-13, stranding the 03-07 instance
            // before the new start.
            const rt = makeRecurringTask({ id: 'rt-e', interval: 3, startDate: '2026-03-13' });
            recurringRepo.store.set(rt.id, rt);
            seed(taskRepo, rt.id, '2026-03-07', true);
            seed(taskRepo, rt.id, '2026-03-13', true);

            const stats = await makeService(recurringRepo, taskRepo).computeStats(rt.id);
            // 03-13 is the (new) start and on-grid; 03-07 counts as adjacent
            // only when the walk from a pre-start date lands on the start
            // itself. The old negative-modulo bug returned a phantom
            // pre-start occurrence (2026-03-10) and broke the streak.
            expect(stats.currentStreak).toBe(2);
            expect(stats.longestStreak).toBe(2);
        });

        it('returns zeroed stats for a template with no instances', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const rt = makeRecurringTask({ id: 'rt-empty' });
            recurringRepo.store.set(rt.id, rt);

            const stats = await makeService(recurringRepo, taskRepo).computeStats(rt.id);
            expect(stats).toEqual({
                recurringTaskId: 'rt-empty',
                currentStreak: 0,
                longestStreak: 0,
                totalCompletions: 0,
                lastCompletedDate: null,
            });
        });

        it('coalesces concurrent computations into a single upsert', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const rt = makeRecurringTask({ id: 'rt-c', startDate: '2026-03-10' });
            recurringRepo.store.set(rt.id, rt);
            seed(taskRepo, rt.id, '2026-03-14', true);
            const service = makeService(recurringRepo, taskRepo);

            const [a, b] = await Promise.all([
                service.computeStats(rt.id),
                service.computeStats(rt.id),
            ]);
            // Both callers share one computation (and one DB write).
            expect(a).toBe(b);
            expect(recurringRepo.upsertCount).toBe(1);
        });

        it('does not rewrite stored stats when nothing changed', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const rt = makeRecurringTask({ id: 'rt-c', startDate: '2026-03-10' });
            recurringRepo.store.set(rt.id, rt);
            seed(taskRepo, rt.id, '2026-03-14', true);
            const service = makeService(recurringRepo, taskRepo);

            await service.computeStats(rt.id); // first read persists
            expect(recurringRepo.upsertCount).toBe(1);
            await service.computeStats(rt.id); // steady state: no rewrite
            expect(recurringRepo.upsertCount).toBe(1);

            seed(taskRepo, rt.id, '2026-03-15', true); // "today" completion
            const stats = await service.computeStats(rt.id);
            expect(stats.currentStreak).toBe(2);
            expect(recurringRepo.upsertCount).toBe(2);
        });

        it('throws NotFoundError for an unknown template', async () => {
            const taskRepo = new FakeTaskRepository();
            const recurringRepo = new FakeRecurringTaskRepository();
            const service = makeService(recurringRepo, taskRepo);
            expect(service.computeStats('nope')).rejects.toBeInstanceOf(NotFoundError);
        });
    });
});
