import type { CreateTaskInput, Task, UpdateTaskInput } from '@erledigen/shared';
import type { TaskRepository } from '../adapters/data/TaskRepository';
import type { UserPreferencesRepository } from '../adapters/data/UserPreferencesRepository';

export class TaskService {
    constructor(
        private taskRepo: TaskRepository,
        private readonly preferencesRepository: UserPreferencesRepository,
    ) {}

    /** Create a task, applying the app-wide rollover default when the
     *  caller did not set a per-task override: the Settings "auto-rollover"
     *  toggle is the default for new tasks, rolloverEnabled stays a
     *  per-task override (set explicitly in the task detail modal). */
    async createTask(input: CreateTaskInput): Promise<Task> {
        const effective: CreateTaskInput =
            input.rolloverEnabled === undefined
                ? {
                      ...input,
                      rolloverEnabled: (await this.preferencesRepository.get()).rolloverEnabled,
                  }
                : input;
        return this.taskRepo.create(effective);
    }

    async listTasks(query: {
        date?: string | undefined;
        tag?: string | undefined;
        completed?: boolean | undefined;
        someDayGroupId?: string | undefined;
        someday?: string | undefined;
        includeDeleted?: boolean | undefined;
    }): Promise<Task[]> {
        let tasks: Task[];
        if (query.someday) {
            tasks = await this.taskRepo.findSomeday();
        } else if (query.someDayGroupId) {
            tasks = await this.taskRepo.findBySomeDayGroup(query.someDayGroupId);
        } else if (query.tag) {
            tasks = await this.taskRepo.findByTags([query.tag]);
        } else if (query.date) {
            tasks = await this.taskRepo.findByDate(query.date);
        } else {
            tasks = await this.taskRepo.findAll();
        }

        if (query.completed !== undefined) {
            tasks = tasks.filter(t => t.completed === query.completed);
        }

        if (query.includeDeleted) {
            const deleted = await this.taskRepo.findDeleted();
            tasks = [...tasks, ...deleted];
        }

        return tasks;
    }

    /** Update a task; when the last child completes, complete the parent.
     *  (This is the general PUT /api/tasks/:id path -- the parent roll-up
     *  is its only completion-specific behavior.) */
    async updateTask(id: string, input: UpdateTaskInput): Promise<Task | null> {
        const task = await this.taskRepo.update(id, input);
        if (!task) return null;

        if (input.completed === true && task.parentId !== null) {
            const siblings = await this.taskRepo.findChildren(task.parentId);
            if (siblings.length > 0 && siblings.every(s => s.completed)) {
                await this.taskRepo.update(task.parentId, { completed: true });
            }
        }

        return task;
    }

    async getTrash(): Promise<Task[]> {
        return this.taskRepo.findDeleted();
    }

    async purge(): Promise<number> {
        return this.taskRepo.purgeDeleted();
    }
}
