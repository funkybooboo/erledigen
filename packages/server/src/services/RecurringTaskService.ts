import type { CreateTaskInput, Task } from '@erledigen/shared';
import { NotFoundError } from '@erledigen/shared';
import type { RecurringTaskRepository } from '../adapters/data/RecurringTaskRepository';
import type { TaskRepository } from '../adapters/data/TaskRepository';
import { generateOccurrences } from '../utils/recurringTaskUtils';

/** Instances generated for one template by generateAllInstances. */
export interface GeneratedForTemplate {
    recurringTaskId: string;
    tasks: Task[];
}

export class RecurringTaskService {
    constructor(
        private recurringTaskRepo: RecurringTaskRepository,
        private taskRepo: TaskRepository,
    ) {}

    /**
     * Generate task instances for one template within a date range
     * (inclusive). Idempotent: occurrence dates that already have an
     * instance (active or completed) are skipped, so overlapping calls
     * never duplicate instances.
     */
    async generateInstances(id: string, startDate: string, endDate: string): Promise<Task[]> {
        const rt = await this.recurringTaskRepo.findById(id);
        if (!rt) throw new NotFoundError(`RecurringTask with ID ${id} not found`);

        const dates = generateOccurrences(rt, startDate, endDate);
        if (dates.length === 0) return [];

        const existing = await this.taskRepo.findByRecurringTaskId(id);
        const existingDates = new Set(existing.map(t => t.instanceDate ?? t.date));
        const newDates = dates.filter(date => !existingDates.has(date));
        if (newDates.length === 0) return [];

        const created = await Promise.all(
            newDates.map(date => {
                const taskInput: CreateTaskInput = {
                    text: rt.text,
                    date,
                    notes: rt.notes,
                    tags: rt.tags,
                    rolloverEnabled: rt.rolloverEnabled,
                    startTime: rt.startTime,
                    // Link the instance back to its template and record the
                    // occurrence date so TaskRow can show the recurring icon
                    // and completion stats can group by template.
                    recurringTaskId: rt.id,
                    instanceDate: date,
                };
                return this.taskRepo.create(taskInput);
            }),
        );

        return created;
    }

    /**
     * Generate missing instances for every template within a date range.
     * Used by the client whenever the visible day range extends, so habits
     * materialize in the daily list automatically. Returns only templates
     * that actually created new instances.
     */
    async generateAllInstances(
        startDate: string,
        endDate: string,
    ): Promise<GeneratedForTemplate[]> {
        const templates = await this.recurringTaskRepo.findAll();
        const results: GeneratedForTemplate[] = [];

        for (const template of templates) {
            const tasks = await this.generateInstances(template.id, startDate, endDate);
            if (tasks.length > 0) {
                results.push({ recurringTaskId: template.id, tasks });
            }
        }

        return results;
    }
}
