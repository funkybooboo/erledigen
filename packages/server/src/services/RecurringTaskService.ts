import type {
    AdoptTaskAsRecurringInput,
    AdoptTaskAsRecurringResult,
    CreateTaskInput,
    DateProvider,
    RecurringTaskStats,
    RecurringTaskStatsWithHistory,
    Task,
} from '@erledigen/shared';
import {
    addDays,
    ConflictError,
    generateOccurrences,
    HABIT_HEATMAP_WINDOW_DAYS,
    NotFoundError,
    nextOccurrenceIso,
} from '@erledigen/shared';
import type { RecurringTaskRepository } from '../adapters/data/RecurringTaskRepository';
import type { TaskRepository } from '../adapters/data/TaskRepository';

/** Instances generated for one template by generateAllInstances. */
export interface GeneratedForTemplate {
    recurringTaskId: string;
    tasks: Task[];
}

/** How far past the schedule start adopt generates instances. Matches
 *  the client's GENERATE_HORIZON_DAYS (recurringTaskStore) so the
 *  promote path materializes exactly as far as creating the habit
 *  through the Habits modal does; the day list extends beyond lazily. */
const ADOPT_HORIZON_DAYS = 90;

/** An occurrence with the fields streak math needs. */
interface Occurrence {
    /** Scheduled date (instanceDate, falling back to the task's date). */
    date: string;
    completed: boolean;
}

export class RecurringTaskService {
    /** computeStats calls in flight, by template id. Concurrent callers
     *  (a burst of task mutations, parallel GETs) share one computation
     *  instead of racing read-modify-write cycles on the same stats row. */
    readonly #inFlight = new Map<string, Promise<RecurringTaskStatsWithHistory>>();

    constructor(
        private recurringTaskRepo: RecurringTaskRepository,
        private taskRepo: TaskRepository,
        private dateProvider: DateProvider,
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
     * Adopt an existing task as the first instance of a new recurring
     * template (the "Make recurring" toggle in the task detail modal).
     *
     * The task itself is never deleted or duplicated: a template is
     * created from its text/notes/tags/rollover, the task is stamped
     * (recurringTaskId + instanceDate) as the template's first instance,
     * and the remaining occurrences are generated from the schedule
     * start (the task's date, or today for a Someday task -- which also
     * gets its date set, since an instance must live on a day). A task
     * already linked to a template is rejected with 409: the public
     * task update API can never write these stamp fields, so this is
     * the only promote path.
     */
    async adoptTaskAsRecurring(
        taskId: string,
        input: AdoptTaskAsRecurringInput,
    ): Promise<AdoptTaskAsRecurringResult> {
        const task = await this.taskRepo.findById(taskId);
        if (!task || task.deletedAt !== null) {
            throw new NotFoundError(`Task with ID ${taskId} not found`);
        }
        if (task.recurringTaskId !== null) {
            throw new ConflictError(`Task ${taskId} already belongs to a recurring task`);
        }

        // The schedule starts where the task already lives; a Someday
        // task moves to today (it becomes today's instance).
        const startDate = task.date ?? this.dateProvider.today();

        // Conditional spreads, not direct assignment: with
        // exactOptionalPropertyTypes, `interval: input.interval` would
        // write an explicit undefined into an optional field.
        const rt = await this.recurringTaskRepo.create({
            text: task.text,
            notes: task.notes,
            tags: task.tags,
            frequency: input.frequency,
            startDate,
            rolloverEnabled: task.rolloverEnabled,
            startTime: input.startTime ?? task.startTime,
            ...(input.interval !== undefined ? { interval: input.interval } : {}),
            ...(input.daysOfWeek !== undefined ? { daysOfWeek: input.daysOfWeek } : {}),
            ...(input.dayOfMonth !== undefined ? { dayOfMonth: input.dayOfMonth } : {}),
            ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
        });

        // Stamp the task as the first instance BEFORE generating, so
        // generateInstances sees its date as taken and never duplicates
        // it. A Someday task gets its date set here as well.
        const stamped = await this.taskRepo.update(taskId, {
            date: startDate,
            recurringTaskId: rt.id,
            instanceDate: startDate,
        });
        if (stamped === null) {
            throw new NotFoundError(`Task with ID ${taskId} not found`);
        }

        // Materialize the remaining occurrences through the standard
        // horizon (same window the client's create-and-generate uses; the
        // day list extends further lazily on scroll).
        const tasks = await this.generateInstances(
            rt.id,
            addDays(startDate, 1),
            addDays(startDate, ADOPT_HORIZON_DAYS),
        );

        return { recurringTask: rt, task: stamped, tasks };
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

    /**
     * Compute, persist, and return streak stats for one template,
     * including the completedDates history the habit heatmap renders.
     *
     * Streaks are measured over the template's materialized instances
     * (what the user has actually seen). Two instances are "adjacent" when
     * the later one is the template's next scheduled occurrence after the
     * earlier one -- a missing day in between breaks the streak. Occurrences
     * after today never affect current or longest streak (completing a
     * future instance early does not extend a streak yet).
     *
     * Recomputing from scratch on every call keeps stats self-healing: any
     * mutation path that forgets to trigger a refresh is corrected on the
     * next read. Concurrent calls for the same template coalesce into one
     * computation, and the result is only persisted when it differs from
     * what is stored -- repeated reads must not rewrite the same row.
     */
    computeStats(id: string): Promise<RecurringTaskStatsWithHistory> {
        const inFlight = this.#inFlight.get(id);
        if (inFlight) return inFlight;
        const computation = this.#computeStats(id).finally(() => {
            this.#inFlight.delete(id);
        });
        this.#inFlight.set(id, computation);
        return computation;
    }

    async #computeStats(id: string): Promise<RecurringTaskStatsWithHistory> {
        const rt = await this.recurringTaskRepo.findById(id);
        if (!rt) throw new NotFoundError(`RecurringTask with ID ${id} not found`);

        const instances = await this.taskRepo.findByRecurringTaskId(id);
        const occurrences: Occurrence[] = instances
            .map(t => ({ date: t.instanceDate ?? t.date, completed: t.completed }))
            .filter((o): o is Occurrence & { date: string } => o.date !== null)
            .sort((a, b) => a.date.localeCompare(b.date));

        const today = this.dateProvider.today();
        const past = occurrences.filter(o => o.date <= today);

        // Current streak: walk backward from the most recent occurrence on
        // or before today. An uncompleted latest occurrence means 0.
        let currentStreak = 0;
        let i = past.length - 1;
        while (i >= 0) {
            const current = past[i];
            if (!current?.completed) break;
            currentStreak++;
            const prev = i > 0 ? past[i - 1] : undefined;
            if (!prev?.completed) break;
            if (nextOccurrenceIso(rt, prev.date) !== current.date) break;
            i--;
        }

        // Longest streak: forward scan; a completed run continues only
        // across adjacent occurrences.
        let computedLongest = 0;
        let run = 0;
        let prev: Occurrence | undefined;
        for (const current of past) {
            if (!current.completed) {
                run = 0;
                prev = current;
                continue;
            }
            const adjacent =
                prev?.completed === true && nextOccurrenceIso(rt, prev.date) === current.date;
            run = adjacent ? run + 1 : 1;
            if (run > computedLongest) computedLongest = run;
            prev = current;
        }

        // "Longest streak" is the best ever, not just the best run that
        // still exists -- uncompleting or deleting an instance must never
        // erase the record.
        const existing = await this.recurringTaskRepo.findStats(id);
        const longestStreak = Math.max(existing?.longestStreak ?? 0, computedLongest);

        const completed = occurrences.filter(o => o.completed);
        const lastCompleted = completed[completed.length - 1];

        // Heatmap history: completed occurrences inside the trailing
        // window (HABIT_HEATMAP_WINDOW_DAYS) -- future completions and
        // anything older than the grid are excluded. Derived on every
        // read, never persisted (upsertStats stores the aggregates only).
        const windowStart = addDays(today, -HABIT_HEATMAP_WINDOW_DAYS);
        const completedDates = completed
            .filter(o => o.date >= windowStart && o.date <= today)
            .map(o => o.date);

        const stats: RecurringTaskStatsWithHistory = {
            recurringTaskId: id,
            currentStreak,
            longestStreak,
            totalCompletions: completed.length,
            lastCompletedDate: lastCompleted ? lastCompleted.date : null,
            completedDates,
        };

        // Persist the aggregates. The stats row carries no history
        // columns, so the derived completedDates are simply not stored.
        const aggregates: RecurringTaskStats = {
            recurringTaskId: stats.recurringTaskId,
            currentStreak: stats.currentStreak,
            longestStreak: stats.longestStreak,
            totalCompletions: stats.totalCompletions,
            lastCompletedDate: stats.lastCompletedDate,
        };

        // Persist only when something changed. GET /stats recomputes on
        // every read; a steady state must not rewrite the same row.
        const unchanged =
            existing !== null &&
            existing.currentStreak === stats.currentStreak &&
            existing.longestStreak === stats.longestStreak &&
            existing.totalCompletions === stats.totalCompletions &&
            existing.lastCompletedDate === stats.lastCompletedDate;
        if (!unchanged) {
            await this.recurringTaskRepo.upsertStats(aggregates);
        }
        return stats;
    }
}
