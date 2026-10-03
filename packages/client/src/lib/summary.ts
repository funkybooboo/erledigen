/**
 * Summary-modal section data (v0.9.0): pure derivations over the loaded
 * stores so the modal stays a thin render and the window/ordering rules
 * are unit-testable (mirrors filters.ts).
 */

import type { Holiday, RecurringTask, Task } from '@erledigen/shared';
import { addDays, daysBetween, hasDeadlineTag } from '@erledigen/shared';

/** Deadlines and holidays look this many days ahead. */
export const SUMMARY_WINDOW_DAYS = 14;

export interface OverdueTask {
    task: Task;
    /** Whole calendar days between the planned date and today. */
    daysLate: number;
}

/** Incomplete tasks scheduled before today, most overdue first. */
export function findOverdueTasks(tasks: Task[], today: string): OverdueTask[] {
    return tasks
        .filter(t => !t.completed && t.date !== null && t.date < today)
        .map(task => ({ task, daysLate: daysBetween(task.date as string, today) }))
        .sort((a, b) => b.daysLate - a.daysLate);
}

/** Tasks tagged `#deadline` scheduled within the next 14 days, soonest
 *  first. Deadline tasks without a date stay out -- "upcoming" needs a
 *  day to count down to. */
export function findUpcomingDeadlineTasks(
    tasks: Task[],
    today: string,
    windowDays: number = SUMMARY_WINDOW_DAYS,
): Task[] {
    const end = addDays(today, windowDays);
    return tasks
        .filter(
            t =>
                !t.completed &&
                hasDeadlineTag(t) &&
                t.date !== null &&
                t.date >= today &&
                t.date <= end,
        )
        .sort((a, b) => (a.date as string).localeCompare(b.date as string));
}

/** Holidays within the next 14 days, soonest first. */
export function findUpcomingHolidays(
    holidays: Holiday[],
    today: string,
    windowDays: number = SUMMARY_WINDOW_DAYS,
): Holiday[] {
    const end = addDays(today, windowDays);
    return holidays
        .filter(h => h.date >= today && h.date <= end)
        .sort((a, b) => a.date.localeCompare(b.date));
}

export interface HabitStreak {
    habit: RecurringTask;
    currentStreak: number;
}

/** Habits with an active streak, longest first (name as tiebreak).
 *  `stats` is keyed by habit id; habits without a stats entry yet are
 *  simply not streaking. */
export function findActiveStreaks(
    habits: RecurringTask[],
    stats: ReadonlyMap<string, { currentStreak: number }>,
): HabitStreak[] {
    const streaks: HabitStreak[] = [];
    for (const habit of habits) {
        const entry = stats.get(habit.id);
        if (entry && entry.currentStreak > 0) {
            streaks.push({ habit, currentStreak: entry.currentStreak });
        }
    }
    return streaks.sort(
        (a, b) => b.currentStreak - a.currentStreak || a.habit.text.localeCompare(b.habit.text),
    );
}
