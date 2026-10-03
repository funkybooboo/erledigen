/**
 * Project auto-distribution (v0.9.0): pure planning for spreading a
 * project's unscheduled tasks across the calendar between its start
 * and due dates. The Projects modal previews the plan and applies it
 * with per-task date updates; no I/O happens here.
 */

import type { Task } from '../types/task';
import { addDays, daysBetween } from './dateKeys';

/** Days to spread across when the project has no due date. */
export const DEFAULT_DISTRIBUTION_SPAN_DAYS = 14;

/** One planned assignment: the task and the date it should land on. */
export interface DistributionAssignment {
    taskId: string;
    date: string;
}

export interface DistributionOptions {
    /** Project start date; null means "from today". */
    startDate: string | null;
    /** Project due date; null means the default span from the start. */
    dueDate: string | null;
    /** Today's key -- the plan never assigns a past date. */
    today: string;
}

/** Tasks eligible for scheduling: top-level (sub-tasks render glued to
 *  their parent in the day list, so a lone sub-task date would have no
 *  visible effect), incomplete, and currently unscheduled (Ready). */
export function distributionEligibleTasks(tasks: Task[]): Task[] {
    return tasks.filter(t => t.parentId === null && !t.completed && t.date === null);
}

/**
 * Order tasks for distribution (Kahn's algorithm): repeatedly take
 * the first task in document order with no unresolved blocker among
 * the eligible set. A blocked task therefore always comes after its
 * blocker, and a dependency cycle -- which never frees a task -- falls
 * back to document order for its members instead of hanging.
 */
function orderForDistribution(tasks: Task[]): Task[] {
    const byId = new Map(tasks.map(t => [t.id, t]));
    const blockersOf = new Map<string, Set<string>>();
    for (const t of tasks) {
        const blockers = new Set<string>();
        // Self-dependency is nonsense data, not an ordering constraint.
        if (t.dependsOn !== null && t.dependsOn !== t.id && byId.has(t.dependsOn)) {
            blockers.add(t.dependsOn);
        }
        blockersOf.set(t.id, blockers);
    }

    const remaining = [...tasks];
    const ordered: Task[] = [];
    while (true) {
        const index = remaining.findIndex(t => (blockersOf.get(t.id)?.size ?? 0) === 0);
        if (index === -1) break;
        const ready = remaining.splice(index, 1)[0] as Task;
        for (const blockers of blockersOf.values()) blockers.delete(ready.id);
        ordered.push(ready);
    }
    // Cycle leftovers (or self-blockers) keep document order.
    ordered.push(...remaining);
    return ordered;
}

/**
 * Plan the distribution: eligible tasks, dependency-ordered, spread
 * round-robin across the window [max(startDate, today), dueDate].
 *
 * - The window never starts in the past (scheduling today counts; the
 *   first assignment lands on the window's first day).
 * - Without a due date the window spans DEFAULT_DISTRIBUTION_SPAN_DAYS
 *   from its start.
 * - More tasks than days wrap: each day takes its fair share.
 * - An empty window (due date already in the past) plans nothing.
 */
export function planProjectDistribution(
    tasks: Task[],
    options: DistributionOptions,
): DistributionAssignment[] {
    const windowStart =
        options.startDate !== null && options.startDate > options.today
            ? options.startDate
            : options.today;
    // A due date that has already passed leaves no assignable window:
    // the plan stays empty rather than silently extending past the due
    // date. A MISSING due date (null) extends to the default span.
    let windowEnd: string;
    if (options.dueDate === null) {
        windowEnd = addDays(windowStart, DEFAULT_DISTRIBUTION_SPAN_DAYS - 1);
    } else if (options.dueDate >= windowStart) {
        windowEnd = options.dueDate;
    } else {
        return [];
    }

    const dayCount = daysBetween(windowStart, windowEnd) + 1;
    const ordered = orderForDistribution(distributionEligibleTasks(tasks));

    return ordered.map((task, index) => ({
        taskId: task.id,
        date: addDays(windowStart, index % dayCount),
    }));
}

/** The first day the plan would assign (window start) -- shown next to
 *  the Auto-distribute preview so the user sees the anchor date. */
export function distributionWindowStart(options: DistributionOptions): string {
    return options.startDate !== null && options.startDate > options.today
        ? options.startDate
        : options.today;
}
