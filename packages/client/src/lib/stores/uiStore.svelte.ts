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

    focusTask(id: string | null) {
        this.focusedTaskId = id;
    }

    setVisibleTasks(ids: string[]) {
        this.visibleTaskIds = ids;
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
