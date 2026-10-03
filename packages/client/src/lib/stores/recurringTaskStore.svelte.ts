import type {
    AdoptTaskAsRecurringInput,
    AdoptTaskAsRecurringResult,
    CreateRecurringTaskInput,
    RecurringTask,
    RecurringTaskStatsWithHistory,
    Task,
    UpdateRecurringTaskInput,
} from '@erledigen/shared';
import { SvelteMap } from 'svelte/reactivity';
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

    get habits(): RecurringTask[] {
        return this.items;
    }

    /** Streak stats by habit id (plus the completedDates heatmap
     *  history), fetched for the Habits modal. SvelteMap (not
     *  $state< Map >): Svelte 5 only deep-proxies plain objects/arrays,
     *  so Map.set on a raw Map would never re-render the modal. SvelteMap
     *  tracks reads of .get() so entries appearing later update the
     *  badge. */
    stats = new SvelteMap<string, RecurringTaskStatsWithHistory>();

    /** A restore replaced every table (ADR-009): refetch the templates
     *  and drop the stats map -- its keys belong to the pre-restore
     *  habit ids. */
    protected override onDataRestored(): void {
        this.fetchAll();
        this.stats.clear();
    }

    /** Fetch (or refresh) stats for the given habit ids. Failures leave
     *  existing entries untouched -- the modal just shows what it has. */
    async fetchStats(ids: string[]): Promise<void> {
        await Promise.all(
            ids.map(async id => {
                try {
                    const stats = await recurringTaskService.getStats(id);
                    this.stats.set(id, stats);
                } catch (error) {
                    // keep whatever we already have for this id
                    this.logFailure('fetchStats', error);
                }
            }),
        );
    }

    /**
     * Promote an existing task to a recurring habit via the adopt
     * endpoint (the Make recurring toggle). Returns the template, the
     * stamped task, and the generated instances, or null on failure.
     * The template joins this store; the caller ingests the returned
     * tasks into taskStore (mirrors createAndGenerate -- the WS
     * broadcast skips the triggering client).
     */
    async adopt(input: AdoptTaskAsRecurringInput): Promise<AdoptTaskAsRecurringResult | null> {
        try {
            const result = await recurringTaskService.adopt(input);
            this.items = [...this.items, result.recurringTask];
            return result;
        } catch (error) {
            this.logFailure('adopt', error);
            return null;
        }
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
        } catch (error) {
            // Creation succeeded; generation can be retried by scrolling.
            this.logFailure('generate', error);
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
        } catch (error) {
            this.logFailure('generateAll', error);
            return [];
        }
    }
}

export const recurringTaskStore = new RecurringTaskStore();
