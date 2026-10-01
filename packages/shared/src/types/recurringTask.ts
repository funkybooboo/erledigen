import type { Task } from './task';

/**
 * How often a recurring task repeats
 */
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * RecurringTask -- a template that generates task instances on a schedule
 */
export interface RecurringTask {
    id: string;
    text: string;
    notes: string | null;
    tags: string[];
    frequency: RecurringFrequency;
    interval: number;
    /** Which weekdays (0-6, 0 = Sunday) the schedule lands on.
     *  Generalizes single-day scheduling and covers "every weekday"
     *  ([1..5]) and "every weekend" ([0, 6]). null = any day. */
    daysOfWeek: number[] | null;
    dayOfMonth: number | null;
    startDate: string;
    endDate: string | null;
    rolloverEnabled: boolean;
    /** Default start time (24h "HH:MM") stamped onto generated instances. */
    startTime: string | null;
    createdAt: string;
    updatedAt: string;
}

/**
 * Streak and completion stats for a recurring task (the persisted
 * aggregates). The service's stats endpoint returns
 * RecurringTaskStatsWithHistory, which layers the heatmap's per-day
 * completion data on top of these.
 */
export interface RecurringTaskStats {
    recurringTaskId: string;
    currentStreak: number;
    longestStreak: number;
    totalCompletions: number;
    lastCompletedDate: string | null;
}

/**
 * Stats plus the completion history the habit heatmap renders.
 * completedDates is derived from the template's instances on every
 * read (like the streaks) and is NOT persisted -- only the four
 * aggregates above are stored.
 */
export interface RecurringTaskStatsWithHistory extends RecurringTaskStats {
    /** ISO dates of completed occurrences within the heatmap window,
     *  ascending. At most one entry per occurrence date. */
    completedDates: string[];
}

/**
 * Input for creating a recurring task template
 */
export type CreateRecurringTaskInput = {
    text: string;
    frequency: RecurringFrequency;
    startDate: string;
    notes?: string | null;
    tags?: string[];
    interval?: number;
    daysOfWeek?: number[] | null;
    dayOfMonth?: number | null;
    endDate?: string | null;
    rolloverEnabled?: boolean;
    startTime?: string | null;
};

/**
 * Input for adopting an existing task as the first instance of a new
 * recurring template (POST /api/recurring-tasks/adopt). The template's
 * text/notes/tags/rollover come from the task; startDate is derived
 * server-side from the task's date (today for a Someday task). Only the
 * schedule itself is caller-supplied.
 */
export type AdoptTaskAsRecurringInput = {
    taskId: string;
    frequency: RecurringFrequency;
    interval?: number;
    daysOfWeek?: number[] | null;
    dayOfMonth?: number | null;
    endDate?: string | null;
    startTime?: string | null;
};

/** Result of adopting a task as recurring: the new template, the adopted
 *  task stamped as the template's first instance, and the additionally
 *  generated instances (the adopted date itself is never re-generated). */
export interface AdoptTaskAsRecurringResult {
    recurringTask: RecurringTask;
    task: Task;
    tasks: Task[];
}

/**
 * Input for updating a recurring task template
 */
export type UpdateRecurringTaskInput = Partial<
    Omit<RecurringTask, 'id' | 'createdAt' | 'updatedAt'>
>;
