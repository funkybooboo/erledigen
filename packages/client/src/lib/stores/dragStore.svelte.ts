import type { Task } from '@erledigen/shared';

/**
 * Cross-component drag state (native HTML5 DnD, v0.6.0). TaskRow arms
 * and starts the drag; the drop zones (DaySection, SomedayPanel)
 * track which zone and insertion point the pointer is over, then
 * commit on drop. One shared store because drags cross panel
 * boundaries (day list <-> Someday).
 */
class DragStore {
    /** The task being dragged (null = no active drag). */
    draggingTask = $state<Task | null>(null);
    /** Zone id under the pointer: `day:<date>`, `someday-group:<id>`,
     *  or `someday-ungrouped`. Zones overwrite this on dragover. */
    overZone = $state<string | null>(null);
    /** Row id the insertion indicator renders before (null = end). */
    insertBeforeId = $state<string | null>(null);

    start(task: Task): void {
        this.draggingTask = task;
    }

    /** Zone + insertion-point update from a dragover handler. The
     *  dragged task never becomes its own insertion point. */
    hover(zoneId: string, beforeId: string | null): void {
        this.overZone = zoneId;
        if (this.draggingTask?.id !== beforeId) {
            this.insertBeforeId = beforeId;
        }
    }

    isDragging(id: string): boolean {
        return this.draggingTask?.id === id;
    }

    clear(): void {
        this.draggingTask = null;
        this.overZone = null;
        this.insertBeforeId = null;
    }
}

export const dragStore = new DragStore();
