import type { Task } from '@erledigen/shared';

/**
 * Pure logic for the native HTML5 drag-and-drop (v0.6.0 reactivated
 * design). The components own the DOM events; everything computable
 * lives here so it is unit-tested without a browser.
 *
 * Positions are global integers (the display comparator below), but
 * only the relative order WITHIN one drop zone matters: every zone
 * (a day section, a Someday group, the ungrouped bucket) renumbers
 * its own list densely 0..n-1 on drop. Cross-day position collisions
 * are harmless because each day renders only its own subset.
 */

/** Display order: position (null = unplaced, sinks) then createdAt.
 *  Mirrors groupTasksByDate so Someday can reuse the same ordering. */
export function byPositionThenCreated(a: Task, b: Task): number {
    const posA = a.position ?? Number.POSITIVE_INFINITY;
    const posB = b.position ?? Number.POSITIVE_INFINITY;
    if (posA !== posB) return posA - posB;
    return a.createdAt.localeCompare(b.createdAt);
}

/**
 * Snap a drop index to a block boundary: sub-tasks render glued to
 * their parent (groupTasksByDate re-appends children right after the
 * parent), so an insertion point "before a sub-task" effectively
 * lands after the parent's whole block. The indicator and the drop
 * math both use this so what you see is what you get.
 */
export function snapInsertBeforeId(tasks: Task[], beforeId: string | null): string | null {
    if (beforeId === null) return null;
    const index = tasks.findIndex(t => t.id === beforeId);
    if (index === -1) return null;
    const target = tasks[index];
    if (target.parentId === null) return beforeId;
    // Walk past the rest of the parent block; the insertion goes
    // before the first row outside it (null = after the last row).
    for (let i = index + 1; i < tasks.length; i++) {
        if (tasks[i].parentId !== target.parentId) return tasks[i].id;
    }
    return null;
}

/**
 * The zone's task list after `dragged` lands before `beforeId`
 * (null = end). Two cases:
 *  - dragged is already in the zone -> reorder; returns null when the
 *    move is a no-op so callers skip the network round-trips
 *  - dragged comes from another zone -> plain insertion (always a
 *    real change).
 */
export function planDrop(zoneTasks: Task[], dragged: Task, beforeId: string | null): Task[] | null {
    if (zoneTasks.some(t => t.id === dragged.id)) {
        // "Before itself" is where the task already sits: a no-op, not
        // a jump to the end (the drag store skips that indicator too).
        if (beforeId === dragged.id) return null;
        const without = zoneTasks.filter(t => t.id !== dragged.id);
        const target = snapInsertBeforeId(without, beforeId);
        const targetIndex =
            target === null ? without.length : without.findIndex(t => t.id === target);
        // No-op detection reads the ORIGINAL order (the neighbor check
        // in `without` cannot see that the dragged task already sat
        // directly before the target).
        const origTargetIndex =
            target === null ? zoneTasks.length : zoneTasks.findIndex(t => t.id === target);
        const noOp =
            (target === null && zoneTasks[zoneTasks.length - 1]?.id === dragged.id) ||
            (target !== null &&
                origTargetIndex > 0 &&
                zoneTasks[origTargetIndex - 1].id === dragged.id);
        if (noOp) return null;
        without.splice(targetIndex, 0, dragged);
        return without;
    }
    const target = snapInsertBeforeId(zoneTasks, beforeId);
    const index = target === null ? zoneTasks.length : zoneTasks.findIndex(t => t.id === target);
    const out = [...zoneTasks];
    out.splice(index, 0, dragged);
    return out;
}

/**
 * Dense renumber of a zone's display order: position i for row i, but
 * only emitted when it actually differs from the task's current
 * position (null never equals an integer, so unplaced rows patch).
 */
export function positionPatches(zoneTasks: Task[]): Array<{ id: string; position: number }> {
    const patches: Array<{ id: string; position: number }> = [];
    for (const [index, task] of zoneTasks.entries()) {
        if (task.position !== index) patches.push({ id: task.id, position: index });
    }
    return patches;
}
