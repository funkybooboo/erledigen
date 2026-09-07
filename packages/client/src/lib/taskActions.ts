/**
 * Task-level user actions shared by every UI surface that triggers them.
 *
 * The delete flow lives here -- not in each component -- so all surfaces
 * get identical behavior: the delete-confirmation preference, the undo
 * toast, and the clone-at-delete-time snapshot. Three hand-written copies
 * of this flow had already drifted apart (the row X button and the task
 * detail modal ignored the confirmation preference entirely).
 */

import type { Task } from '@erledigen/shared';
import { notificationStore, preferencesStore, taskStore, uiStore } from '$lib/stores';

/** How a requested deletion settled. */
export type DeleteOutcome =
    /** The delete round-trip succeeded; an Undo toast is showing. */
    | 'deleted'
    /** The user answered the confirmation with Cancel/dismissed it. */
    | 'declined'
    /** The delete was attempted but failed (logged by the store). */
    | 'failed';

/**
 * Delete a task after honoring the delete-confirmation preference, then
 * push an Undo notification on success.
 */
export async function deleteTaskWithUndo(task: Task): Promise<DeleteOutcome> {
    if (preferencesStore.deleteConfirmation === 'confirm') {
        const ok = await uiStore.confirm(`Delete "${task.text}"?`);
        if (!ok) return 'declined';
    }

    // Clone at delete time: the store's copy can keep changing, but Undo
    // must restore exactly the state the user saw when they deleted.
    const taskCopy: Task = { ...task };
    const success = await taskStore.remove(task.id);
    if (!success) return 'failed';

    notificationStore.push('Task deleted', {
        kind: 'info',
        action: { label: 'Undo', fn: () => taskStore.restore(taskCopy) },
    });
    return 'deleted';
}
