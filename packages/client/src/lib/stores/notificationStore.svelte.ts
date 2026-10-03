type NotificationKind = 'success' | 'warning' | 'error' | 'info';

interface Notification {
    id: string;
    message: string;
    kind: NotificationKind;
    iconType: string;
    action?: { label: string; fn: () => void; redo?: () => void };
    duration: number;
    entering: boolean;
    leaving: boolean;
}

/** Undoable entry in the undo history. */
interface UndoEntry {
    notificationId: string;
    /** Reverts the action (Ctrl/Cmd+Z, or the toast's Undo button). */
    fn: () => void;
    /** Re-applies the action after an undo (Ctrl/Cmd+Shift+Z); null when
     *  the action cannot be replayed. */
    redo: (() => void) | null;
}

/** An undone action waiting to be replayed (Ctrl/Cmd+Shift+Z). */
interface RedoEntry {
    fn: () => void;
}

let nextId = 0;

class NotificationStore {
    notifications = $state<Notification[]>([]);
    #timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

    /** Undoable actions, newest last. These outlive their toasts: the
     *  Ctrl/Cmd+Z binding pops this history even after the notification
     *  has expired, so "Undo" is not a 4-second-only affordance. Capped so
     *  an undo cannot resurrect arbitrarily old state; every entry is
     *  consumed exactly once (toast button or keyboard). */
    #undoHistory: UndoEntry[] = [];
    static readonly UNDO_HISTORY_MAX = 20;

    /** Undone actions that can be replayed with redo (Ctrl/Cmd+Shift+Z),
     *  newest last. A new undoable action clears it: redo only ever
     *  replays a contiguous prefix of undone actions. */
    #redoHistory: RedoEntry[] = [];
    static readonly REDO_HISTORY_MAX = 20;

    push(
        message: string,
        options?: {
            kind?: NotificationKind;
            iconType?: string;
            action?: { label: string; fn: () => void; redo?: () => void };
            duration?: number;
        },
    ): string {
        const id = `notif_${++nextId}`;
        const kind = options?.kind ?? 'info';
        const notification: Notification = {
            id,
            message,
            kind,
            iconType: options?.iconType ?? kind,
            action: options?.action,
            duration: options?.duration ?? 4000,
            entering: true,
            leaving: false,
        };

        if (notification.action) {
            this.#undoHistory.push({
                notificationId: id,
                fn: notification.action.fn,
                redo: notification.action.redo ?? null,
            });
            if (this.#undoHistory.length > NotificationStore.UNDO_HISTORY_MAX) {
                this.#undoHistory.shift();
            }
            // A new action forks history: the redo stack can no longer
            // reach the state it was rewound from.
            this.#redoHistory = [];
        }

        this.notifications = [...this.notifications, notification];

        requestAnimationFrame(() => {
            this.notifications = this.notifications.map(n =>
                n.id === id ? { ...n, entering: false } : n,
            );
        });

        this.#scheduleDismiss(id, notification.duration);
        return id;
    }

    dismiss(id: string): void {
        const timer = this.#timers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.#timers.delete(id);
        }

        this.notifications = this.notifications.map(n =>
            n.id === id ? { ...n, leaving: true } : n,
        );

        setTimeout(() => {
            this.notifications = this.notifications.filter(n => n.id !== id);
        }, 200);
    }

    /**
     * Run a notification's action from its toast button, then dismiss it.
     * Consumes the matching undo-history entry so Ctrl/Cmd+Z can never
     * replay an action that was already run. Returns false when the
     * notification no longer exists or has no action.
     */
    runAction(id: string): boolean {
        const notification = this.notifications.find(n => n.id === id && !n.leaving);
        if (!notification?.action) return false;
        this.#consumeUndoEntry(id);
        this.dismiss(id);
        notification.action.fn();
        // A toast-button undo replays like a keyboard undo: stash the
        // action's redo counterpart when the notification has one.
        if (notification.action.redo) {
            this.#pushRedo(notification.action.redo);
        }
        return true;
    }

    /**
     * Undo the most recent undoable action (the Ctrl/Cmd+Z binding), even
     * if its toast has already expired. Returns false when there is
     * nothing left to undo.
     */
    undoLatest(): boolean {
        const entry = this.#undoHistory.pop();
        if (!entry) return false;
        // Dismiss the toast too when it is still on screen.
        if (this.notifications.some(n => n.id === entry.notificationId && !n.leaving)) {
            this.dismiss(entry.notificationId);
        }
        entry.fn();
        if (entry.redo) this.#pushRedo(entry.redo);
        return true;
    }

    /**
     * Replay the most recent undone action (the Ctrl/Cmd+Shift+Z
     * binding). Returns false when there is nothing to redo.
     */
    redoLatest(): boolean {
        const entry = this.#redoHistory.pop();
        if (!entry) return false;
        entry.fn();
        return true;
    }

    #pushRedo(fn: () => void): void {
        this.#redoHistory.push({ fn });
        if (this.#redoHistory.length > NotificationStore.REDO_HISTORY_MAX) {
            this.#redoHistory.shift();
        }
    }

    #consumeUndoEntry(notificationId: string): void {
        const idx = this.#undoHistory.findIndex(e => e.notificationId === notificationId);
        if (idx !== -1) this.#undoHistory.splice(idx, 1);
    }

    clear(): void {
        for (const timer of this.#timers.values()) {
            clearTimeout(timer);
        }
        this.#timers.clear();
        this.notifications = [];
        this.#undoHistory = [];
        this.#redoHistory = [];
    }

    #scheduleDismiss(id: string, duration: number): void {
        const timer = setTimeout(() => {
            this.dismiss(id);
        }, duration);
        this.#timers.set(id, timer);
    }
}

export const notificationStore = new NotificationStore();
