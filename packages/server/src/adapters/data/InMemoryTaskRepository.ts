import type { CreateTaskInput, DateProvider, Task, UpdateTaskInput } from '@erledigen/shared';
import { PURGE_RETENTION_DAYS, TASK_DEFAULTS } from '@erledigen/shared';
import type { TaskRepository } from './TaskRepository';

export class InMemoryTaskRepository implements TaskRepository {
    private tasks: Map<string, Task> = new Map();
    private idCounter = 0;

    constructor(private dateProvider: DateProvider) {}

    async findAll(): Promise<Task[]> {
        return this.activeTasks().sort((a, b) => {
            if (a.date === null && b.date === null) return a.createdAt.localeCompare(b.createdAt);
            if (a.date === null) return 1;
            if (b.date === null) return -1;
            const dateCompare = a.date.localeCompare(b.date);
            if (dateCompare !== 0) return dateCompare;
            return a.createdAt.localeCompare(b.createdAt);
        });
    }

    async findByDate(date: string): Promise<Task[]> {
        return this.activeTasks()
            .filter(task => task.date === date)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }

    async findSomeday(): Promise<Task[]> {
        return this.activeTasks()
            .filter(task => task.date === null)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }

    async findByRecurringTaskId(recurringTaskId: string): Promise<Task[]> {
        return this.activeTasks().filter(task => task.recurringTaskId === recurringTaskId);
    }

    async findBySomeDayGroup(groupId: string): Promise<Task[]> {
        return this.activeTasks()
            .filter(task => task.someDayGroupId === groupId)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }

    async findChildren(parentId: string): Promise<Task[]> {
        return this.activeTasks()
            .filter(task => task.parentId === parentId)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }

    async findByTags(tags: string[]): Promise<Task[]> {
        if (tags.length === 0) return this.findAll();
        return this.activeTasks()
            .filter(task => tags.some(t => task.tags.includes(t)))
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }

    async findById(id: string): Promise<Task | null> {
        const task = this.tasks.get(id);
        if (!task || task.deletedAt !== null) return null;
        return task;
    }

    async create(input: CreateTaskInput): Promise<Task> {
        const now = this.dateProvider.timestamp();
        const id = (++this.idCounter).toString();

        const task: Task = {
            id,
            text: input.text,
            notes: input.notes ?? null,
            completed: input.completed ?? false,
            date: input.date ?? null,
            createdAt: now,
            updatedAt: now,
            tags: input.tags ?? [...TASK_DEFAULTS.tags],
            parentId: input.parentId ?? null,
            rolloverEnabled: input.rolloverEnabled ?? TASK_DEFAULTS.rolloverEnabled,
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

        this.tasks.set(id, task);
        return task;
    }

    async createMany(inputs: CreateTaskInput[]): Promise<Task[]> {
        // Sequential creates: in-memory has no transaction, but every
        // create() is synchronous under the async facade.
        const created: Task[] = [];
        for (const input of inputs) {
            created.push(await this.create(input));
        }
        return created;
    }

    async replaceAll(tasks: Task[]): Promise<void> {
        this.tasks.clear();
        for (const task of tasks) {
            this.tasks.set(task.id, { ...task });
        }
        // New ids must never collide with restored ones: reset the
        // counter to the highest numeric restored id.
        this.idCounter = tasks.reduce(
            (max, task) => Math.max(max, Number.parseInt(task.id, 10) || 0),
            0,
        );
    }

    async update(id: string, input: UpdateTaskInput): Promise<Task | null> {
        const existing = this.tasks.get(id);
        if (!existing || existing.deletedAt !== null) return null;

        const updated: Task = {
            ...existing,
            ...input,
            updatedAt: this.dateProvider.timestamp(),
        };

        this.tasks.set(id, updated);
        return updated;
    }

    async delete(id: string): Promise<boolean> {
        const existing = this.tasks.get(id);
        if (!existing) return false;
        if (existing.deletedAt !== null) return false;

        const softDeleted: Task = {
            ...existing,
            deletedAt: this.dateProvider.timestamp(),
            updatedAt: this.dateProvider.timestamp(),
        };

        this.tasks.set(id, softDeleted);
        return true;
    }

    async forceDelete(id: string): Promise<boolean> {
        return this.tasks.delete(id);
    }

    async restore(id: string): Promise<Task | null> {
        const existing = this.tasks.get(id);
        if (!existing || existing.deletedAt === null) return null;

        const restored: Task = {
            ...existing,
            deletedAt: null,
            updatedAt: this.dateProvider.timestamp(),
        };

        this.tasks.set(id, restored);
        return restored;
    }

    async findDeleted(maxAgeDays: number = PURGE_RETENTION_DAYS): Promise<Task[]> {
        // The retention window is NOT applied here, matching the SQLite
        // adapter (documented there too): findDeleted returns the full
        // trash list; only purgeDeleted enforces the cutoff.
        void maxAgeDays;
        return Array.from(this.tasks.values())
            .filter(task => task.deletedAt !== null)
            .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''));
    }

    async purgeDeleted(maxAgeDays: number = PURGE_RETENTION_DAYS): Promise<number> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - maxAgeDays);
        const cutoffStr = cutoff.toISOString();

        let purged = 0;
        for (const [id, task] of this.tasks) {
            if (task.deletedAt !== null && task.deletedAt < cutoffStr) {
                this.tasks.delete(id);
                purged++;
            }
        }
        return purged;
    }

    async count(): Promise<number> {
        return this.activeTasks().length;
    }

    async findRolloverCandidates(today: string): Promise<Task[]> {
        return this.activeTasks()
            .filter(
                task =>
                    !task.completed &&
                    task.rolloverEnabled &&
                    task.recurringTaskId === null &&
                    task.date !== null &&
                    task.date < today,
            )
            .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    }

    async rolloverTask(
        id: string,
        nextDate: string,
        originalScheduledDate: string,
        daysLate: number,
    ): Promise<Task | null> {
        // Build a new object like every other mutator here: in-place
        // mutation of the stored Task would also hand the caller a live
        // reference into the store.
        const task = this.tasks.get(id);
        if (task === undefined || task.deletedAt !== null) return null;
        const rolled: Task = {
            ...task,
            date: nextDate,
            originalScheduledDate,
            daysLate,
            updatedAt: this.dateProvider.timestamp(),
        };
        this.tasks.set(id, rolled);
        return { ...rolled };
    }

    async deleteAll(): Promise<void> {
        this.tasks.clear();
        this.idCounter = 0;
    }

    private activeTasks(): Task[] {
        return Array.from(this.tasks.values()).filter(t => t.deletedAt === null);
    }
}
