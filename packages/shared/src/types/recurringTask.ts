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
 * Streak and completion stats for a recurring task
 */
export interface RecurringTaskStats {
    recurringTaskId: string;
    currentStreak: number;
    longestStreak: number;
    totalCompletions: number;
    lastCompletedDate: string | null;
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
 * Input for updating a recurring task template
 */
export type UpdateRecurringTaskInput = Partial<
    Omit<RecurringTask, 'id' | 'createdAt' | 'updatedAt'>
>;
