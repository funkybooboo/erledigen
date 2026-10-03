import type { ActiveFilters, Task } from '@erledigen/shared';

/** Priority tags in sort order (the tag-kind convention; see tagKinds). */
const PRIORITY_TAGS = ['p1', 'p2', 'p3'];

/** Sort rank of a task: 0 for #p1 .. 2 for #p3, 3 for untagged. */
function priorityRank(task: Task): number {
    for (const [index, tag] of PRIORITY_TAGS.entries()) {
        if (task.tags.includes(tag)) return index;
    }
    return PRIORITY_TAGS.length;
}

/**
 * Apply the active filters to a task list. Completed tasks are NEVER hidden -- they
 * stay visible (just struck-through) so the day's full state is always on
 * screen. Incomplete past-day tasks roll over to the next day via
 * auto-rollover, so there's no overdue state to hide either.
 *
 * The date-range bounds hide scheduled tasks whose date falls outside
 * [dateFrom, dateTo] (inclusive). Date-less tasks (the Someday panel) are
 * exempt -- a range narrows the day rail, it does not empty the Someday
 * panel.
 */
export function applyFilters(tasks: Task[], filters: ActiveFilters): Task[] {
    let out = tasks;
    if (filters.tags.length > 0) {
        out = out.filter(t => filters.tags.some(tag => t.tags.includes(tag)));
    }
    if (filters.dateFrom !== null || filters.dateTo !== null) {
        out = out.filter(t => {
            if (t.date === null) return true;
            if (filters.dateFrom !== null && t.date < filters.dateFrom) return false;
            if (filters.dateTo !== null && t.date > filters.dateTo) return false;
            return true;
        });
    }
    return out;
}

/**
 * Order tasks for display within one day section. 'manual' keeps the
 * default position/creation order; 'priority' sorts #p1 -> #p2 -> #p3 ->
 * untagged. Sub-tasks stay attached: a parent and its children move as
 * one block ranked by the parent's priority (groupTasksByDate always
 * places a parent before its children, so blocks form in one pass).
 * Array#sort is stable, so equal ranks keep their existing order.
 */
export function sortTasksForView(tasks: Task[], sortMode: ActiveFilters['sortMode']): Task[] {
    if (sortMode !== 'priority') return tasks;
    const blocks: Task[][] = [];
    for (const task of tasks) {
        const parentBlock =
            task.parentId === null
                ? undefined
                : blocks.find(b => b[0]?.id === task.parentId && b[0]?.parentId === null);
        if (parentBlock) parentBlock.push(task);
        else blocks.push([task]);
    }
    return blocks
        .sort((a, b) => {
            const headA = a[0];
            const headB = b[0];
            if (!headA || !headB) return 0;
            return priorityRank(headA) - priorityRank(headB);
        })
        .flat();
}
