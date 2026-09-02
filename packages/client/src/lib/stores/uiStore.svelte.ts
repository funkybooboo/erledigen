export type ModalType =
    | 'summary'
    | 'projects'
    | 'habits'
    | 'calendar'
    | 'search'
    | 'filter'
    | 'trash'
    | 'settings'
    | 'help'
    | 'taskDetail';

class UIStore {
    focusedTaskId = $state<string | null>(null);
    activeModal = $state<ModalType | null>(null);
    editingTaskId = $state<string | null>(null);

    /** Task ids in day-list order, as currently rendered by DayList.
     *  Published by DayList so the global j/k focus navigation knows the
     *  on-screen order (which respects filters and the scrolled window). */
    visibleTaskIds = $state<string[]>([]);

    /** Task ids in Someday-panel render order (groups, then ungrouped).
     *  Published by SomedayPanel; j/k navigation uses it when the focused
     *  task lives in the panel. Empty when the panel is collapsed. */
    visibleSomedayTaskIds = $state<string[]>([]);

    /** Pending request to focus a day section's add-task input. The
     *  matching DaySection consumes it and focuses its InlineAddTask --
     *  store-driven, so no component reaches into another's DOM by id. */
    addInputFocus = $state<{ date: string } | null>(null);

    /** Pending destructive-action confirmation, rendered as ConfirmModal. */
    confirmRequest = $state<{
        message: string;
        confirmLabel: string;
        resolve: (ok: boolean) => void;
    } | null>(null);

    focusTask(id: string | null) {
        this.focusedTaskId = id;
    }

    setVisibleTasks(ids: string[]) {
        this.visibleTaskIds = ids;
    }

    setVisibleSomedayTasks(ids: string[]) {
        this.visibleSomedayTaskIds = ids;
    }

    /** Ask the DaySection for `date` to focus its add-task input. */
    requestAddInputFocus(date: string) {
        this.addInputFocus = { date };
    }

    /** DaySection-side counterpart of requestAddInputFocus: claims the
     *  pending request when it targets this section's date. */
    consumeAddInputFocus(date: string): boolean {
        if (this.addInputFocus?.date !== date) return false;
        this.addInputFocus = null;
        return true;
    }

    /** Ask the user to confirm a destructive action through ConfirmModal
     *  (never window.confirm -- a blocking dialog freezes the whole app,
     *  including toasts and live sync). Resolves false when dismissed. */
    confirm(message: string, confirmLabel = 'Delete'): Promise<boolean> {
        // A second request while one is pending supersedes it.
        this.resolveConfirm(false);
        return new Promise(resolve => {
            this.confirmRequest = { message, confirmLabel, resolve };
        });
    }

    /** Settle the pending confirmation (ConfirmModal buttons, or its
     *  Modal's close paths). */
    resolveConfirm(ok: boolean) {
        const request = this.confirmRequest;
        this.confirmRequest = null;
        request?.resolve(ok);
    }

    openModal(modal: ModalType) {
        this.activeModal = modal;
    }

    closeModal() {
        this.activeModal = null;
    }

    startEditing(taskId: string | null) {
        this.editingTaskId = taskId;
    }

    reset() {
        this.focusedTaskId = null;
        this.activeModal = null;
        this.editingTaskId = null;
    }
}

export const uiStore = new UIStore();
