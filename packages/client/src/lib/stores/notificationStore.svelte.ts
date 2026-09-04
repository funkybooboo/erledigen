type NotificationKind = 'success' | 'warning' | 'error' | 'info';

interface Notification {
    id: string;
    message: string;
    kind: NotificationKind;
    iconType: string;
    action?: { label: string; fn: () => void };
    duration: number;
    entering: boolean;
    leaving: boolean;
}

/** Undoable entry in the undo history. */
interface UndoEntry {
    notificationId: string;
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

    push(
        message: string,
        options?: {
            kind?: NotificationKind;
            iconType?: string;
            action?: { label: string; fn: () => void };
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
            this.#undoHistory.push({ notificationId: id, fn: notification.action.fn });
            if (this.#undoHistory.length > NotificationStore.UNDO_HISTORY_MAX) {
                this.#undoHistory.shift();
            }
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
        return true;
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
    }

    #scheduleDismiss(id: string, duration: number): void {
        const timer = setTimeout(() => {
            this.dismiss(id);
        }, duration);
        this.#timers.set(id, timer);
    }
}

export const notificationStore = new NotificationStore();
