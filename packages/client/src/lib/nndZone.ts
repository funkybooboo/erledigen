import type { Task, UpdateTaskInput } from '@erledigen/shared';
import { planDrop, positionPatches, snapInsertBeforeId } from './dragReorder';
import { dragStore } from './stores/dragStore.svelte';

/**
 * Shared plumbing for the native HTML5 drop zones (day sections,
 * Someday groups, the ungrouped bucket). The zones differ only in
 * what they put in the dragged task's base input (date vs
 * date+groupId); the pointer scanning, highlight bookkeeping, and
 * position rewrite are identical and live here.
 */

/** Row id the pointer Y would insert before (null = end of list). */
export function scanInsertBefore(listEl: HTMLElement | undefined, clientY: number): string | null {
    if (!listEl) return null;
    for (const row of listEl.querySelectorAll<HTMLDivElement>('.task-row-wrapper')) {
        const rect = row.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) {
            return row.dataset.taskId ?? null;
        }
    }
    return null;
}

/** dragover handler body for a drop zone. stopPropagation keeps nested
 *  zones (Someday groups inside the panel-content fallback) from
 *  double-tracking; sibling zones are unaffected. */
export function zoneDragOver(zoneId: string, e: DragEvent, listEl: HTMLElement | undefined): void {
    if (!dragStore.draggingTask) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dragStore.hover(zoneId, scanInsertBefore(listEl, e.clientY));
}

/** dragleave handler body: child elements fire leave constantly, so
 *  only clear the highlight when the pointer left the zone entirely. */
export function zoneDragLeave(zoneId: string, e: DragEvent, zoneEl: HTMLElement): void {
    const next = e.relatedTarget;
    if (next instanceof Node && zoneEl.contains(next)) return;
    if (dragStore.overZone === zoneId) dragStore.overZone = null;
}

/**
 * Commit a drop into a zone: read the insertion point, clear the drag
 * state, rewrite positions densely (0..n-1, patched only where the
 * integer changed), and send the dragged task's zone move with its new
 * position while shifted siblings only carry positions. `update`
 * abstracts taskStore.update so this stays store-agnostic/testable.
 * Returns the effective new order, or null on a same-zone no-op.
 */
export function commitZoneDrop(
    zoneTasks: Task[],
    dragged: Task,
    baseInput: UpdateTaskInput,
    update: (id: string, input: UpdateTaskInput) => unknown,
): Task[] | null {
    const beforeId = snapInsertBeforeId(zoneTasks, dragStore.insertBeforeId);
    dragStore.clear();
    const newOrder = planDrop(zoneTasks, dragged, beforeId);
    if (!newOrder) return null; // same-zone no-op: nothing to send
    const patches = positionPatches(newOrder);
    const input = { ...baseInput };
    const draggedPatch = patches.find(p => p.id === dragged.id);
    if (draggedPatch) input.position = draggedPatch.position;
    if (Object.keys(input).length > 0) update(dragged.id, input);
    for (const patch of patches) {
        if (patch.id === dragged.id) continue;
        update(patch.id, { position: patch.position });
    }
    return newOrder;
}
