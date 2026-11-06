/**
 * Project home derivation (USE-17, ADR-011).
 *
 * A project is a lens, never a container: everything here is derived
 * from work that lives on days or in someday lists, joined by the
 * project's tag. Pure functions -- the modal renders what these
 * produce, and the unit tests pin the grouping rules.
 */

import type {
    Project,
    RecurringTask,
    RecurringTaskStats,
    SomedayList,
    Task,
} from '@erledigen/shared';

/** Backlog group: the parked (undated, incomplete) tasks of one list.
 *  `listId: null` is the Unlisted catch-all (the default tab's
 *  implicit section owns those in the Someday panel). */
export interface ProjectBacklogGroup {
    listId: string | null;
    listName: string;
    tasks: Task[];
}

/** Scheduled group: the dated, incomplete tasks of one day. */
export interface ProjectScheduledDay {
    date: string;
    tasks: Task[];
}

/** A routine wearing the project tag, with its current streak. */
export interface ProjectRoutine {
    habit: RecurringTask;
    streak: number;
}

export interface ProjectHome {
    backlog: ProjectBacklogGroup[];
    scheduled: ProjectScheduledDay[];
    routines: ProjectRoutine[];
    doneCount: number;
    doneRecent: Task[];
}

/** How many of the project's completed tasks the Done section shows. */
export const DONE_RECENT_LIMIT = 10;

/** The day-list display order: manual position first, then arrival
 *  (mirrors groupTasksByDate's comparator). */
function byPositionThenCreated(a: Task, b: Task): number {
    const posA = a.position ?? Infinity;
    const posB = b.position ?? Infinity;
    return posA - posB || a.createdAt.localeCompare(b.createdAt);
}

/** Glue each parent's children right after it (the same nesting the
 *  day list renders): sub-tasks follow their parent into its group,
 *  tag or no tag -- the parent is the project's member, the child
 *  rides along. */
function glueChildren(parents: Task[], allTasks: Task[]): Task[] {
    const byParent = new Map<string, Task[]>();
    for (const task of allTasks) {
        if (task.parentId === null) continue;
        const siblings = byParent.get(task.parentId) ?? [];
        siblings.push(task);
        byParent.set(task.parentId, siblings);
    }
    const ordered: Task[] = [];
    for (const parent of [...parents].sort(byPositionThenCreated)) {
        ordered.push(parent);
        ordered.push(...(byParent.get(parent.id) ?? []).sort(byPositionThenCreated));
    }
    return ordered;
}

/**
 * Gather everything wearing the project's tag into the home view:
 * backlog by list, scheduled by day, routines with streaks, and the
 * done count with the most recent completions. Nothing here mutates,
 * moves, or owns the work -- it reads.
 */
export function gatherProjectHome(
    project: Project,
    tasks: Task[],
    lists: SomedayList[],
    habits: RecurringTask[],
    stats: Map<string, RecurringTaskStats>,
): ProjectHome {
    const wearing = tasks.filter(t => t.tags.includes(project.tag));

    // Backlog: undated, incomplete, grouped by their someday list.
    const backlogParents = wearing.filter(t => t.date === null && !t.completed);
    const backlogByList = new Map<string | null, Task[]>();
    for (const task of backlogParents) {
        const group = backlogByList.get(task.somedayListId) ?? [];
        group.push(task);
        backlogByList.set(task.somedayListId, group);
    }
    const listsById = new Map(lists.map(l => [l.id, l] as const));
    const backlogOrder = new Map(
        [...listsById.values()]
            .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
            .map((l, i) => [l.id, i] as const),
    );
    const backlogGroups: ProjectBacklogGroup[] = [];
    for (const [listId, groupTasks] of backlogByList) {
        backlogGroups.push({
            listId,
            listName: (listId !== null ? listsById.get(listId)?.name : undefined) ?? '',
            tasks: glueChildren(groupTasks, tasks),
        });
    }
    // Lists first (by their panel position), Unlisted last.
    backlogGroups.sort((a, b) => {
        if (a.listId === null) return 1;
        if (b.listId === null) return -1;
        return (backlogOrder.get(a.listId) ?? 0) - (backlogOrder.get(b.listId) ?? 0);
    });

    // Scheduled: dated, incomplete, grouped by day, soonest first.
    const scheduledParents = wearing.filter(t => t.date !== null && !t.completed);
    const scheduledByDay = new Map<string, Task[]>();
    for (const task of scheduledParents) {
        const day = scheduledByDay.get(task.date as string) ?? [];
        day.push(task);
        scheduledByDay.set(task.date as string, day);
    }
    const scheduled: ProjectScheduledDay[] = [...scheduledByDay.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, dayTasks]) => ({ date, tasks: glueChildren(dayTasks, tasks) }));

    // Routines: habits wearing the tag, with their current streak.
    const routines: ProjectRoutine[] = habits
        .filter(h => h.tags.includes(project.tag))
        .map(habit => ({
            habit,
            streak: stats.get(habit.id)?.currentStreak ?? 0,
        }));

    // Done: every completed member counts; the section shows the most
    // recently completed.
    const done = wearing.filter(t => t.completed);
    const doneRecent = [...done]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, DONE_RECENT_LIMIT);

    return {
        backlog: backlogGroups,
        scheduled,
        routines,
        doneCount: done.length,
        doneRecent,
    };
}
