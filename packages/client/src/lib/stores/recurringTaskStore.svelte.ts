import type {
    CreateRecurringTaskInput,
    RecurringTask,
    Task,
    UpdateRecurringTaskInput,
} from '@erledigen/shared';
import { container } from '$lib/container';
import { RecurringTaskService } from '$lib/services/recurringTaskService';
import { EntityStore } from './entityStore.svelte';

/**
 * How far past today instances are materialized when a habit is created.
 * The day list extends this lazily as the user scrolls (see DayList).
 */
export const GENERATE_HORIZON_DAYS = 90;

const recurringTaskService = new RecurringTaskService(container.httpClient);

class RecurringTaskStore extends EntityStore<
    RecurringTask,
    CreateRecurringTaskInput,
    UpdateRecurringTaskInput
> {
    constructor() {
        super(recurringTaskService);
    }

    get tasks(): RecurringTask[] {
        return this.items;
    }

    /**
     * Create a habit and immediately materialize its instances through
     * `endDate`. Returns null when creation fails. Callers ingest the
     * returned tasks into taskStore (the WS broadcast skips the client
     * that triggered the generate).
     */
    async createAndGenerate(
        input: CreateRecurringTaskInput,
        endDate: string,
    ): Promise<{ habit: RecurringTask; tasks: Task[] } | null> {
        const habit = await this.create(input);
        if (!habit) return null;

        let tasks: Task[] = [];
        try {
            tasks = await recurringTaskService.generate(habit.id, habit.startDate, endDate);
        } catch {
            // Creation succeeded; generation can be retried by scrolling.
        }
        return { habit, tasks };
    }

    /**
     * Ensure instances exist for every habit in a date range (idempotent
     * server-side). Returns the newly created tasks, if any.
     */
    async ensureInstances(startDate: string, endDate: string): Promise<Task[]> {
        try {
            const generated = await recurringTaskService.generateAll(startDate, endDate);
            return generated.flatMap(g => g.tasks);
        } catch {
            return [];
        }
    }
}

export const recurringTaskStore = new RecurringTaskStore();
