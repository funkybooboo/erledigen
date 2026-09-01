import type { CreateTaskInput, DateProvider, RecurringTaskStats, Task } from '@erledigen/shared';
import { NotFoundError } from '@erledigen/shared';
import type { RecurringTaskRepository } from '../adapters/data/RecurringTaskRepository';
import type { TaskRepository } from '../adapters/data/TaskRepository';
import { generateOccurrences, nextOccurrenceIso } from '../utils/recurringTaskUtils';

/** Instances generated for one template by generateAllInstances. */
export interface GeneratedForTemplate {
    recurringTaskId: string;
    tasks: Task[];
}

/** An occurrence with the fields streak math needs. */
interface Occurrence {
    /** Scheduled date (instanceDate, falling back to the task's date). */
    date: string;
    completed: boolean;
}

export class RecurringTaskService {
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
     * Compute, persist, and return streak stats for one template.
     *
     * Streaks are measured over the template's materialized instances
     * (what the user has actually seen). Two instances are "adjacent" when
     * the later one is the template's next scheduled occurrence after the
     * earlier one — a missing day in between breaks the streak. Occurrences
     * after today never affect current or longest streak (completing a
     * future instance early does not extend a streak yet).
     *
     * Recomputing from scratch on every call keeps stats self-healing: any
     * mutation path that forgets to trigger a refresh is corrected on the
     * next read.
     */
    async computeStats(id: string): Promise<RecurringTaskStats> {
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
        // still exists — uncompleting or deleting an instance must never
        // erase the record.
        const existing = await this.recurringTaskRepo.findStats(id);
        const longestStreak = Math.max(existing?.longestStreak ?? 0, computedLongest);

        const completed = occurrences.filter(o => o.completed);
        const lastCompleted = completed[completed.length - 1];
        const stats: RecurringTaskStats = {
            recurringTaskId: id,
            currentStreak,
            longestStreak,
            totalCompletions: completed.length,
            lastCompletedDate: lastCompleted ? lastCompleted.date : null,
        };

        await this.recurringTaskRepo.upsertStats(stats);
        return stats;
    }
}
