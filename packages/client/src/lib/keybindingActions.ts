/**
 * Handlers behind the shortcut registry -- the Record<ShortcutId,
 * KeyboardAction> that lib/keyboard.ts dispatches into.
 *
 * TypeScript requires an entry for every registry id, so a shortcut
 * cannot exist without a handler (and a removed shortcut orphans its
 * entry and fails type-check). The registry/handler pairing is therefore
 * enforced by the compiler, and keyboard.test.ts proves every binding
 * string actually resolves through the matcher.
 *
 * The DOM/store gates live here too: typing targets, open overlays, and
 * the native-activation rule for Space/Enter. routes/+layout.svelte just
 * wires svelte:window to handleGlobalKeydown.
 */

import type { Task } from '@erledigen/shared';
import { container } from '$lib/container';
import type { ShortcutId } from '$lib/keybindings';
import { type KeybindingEvent, KeybindingMatcher } from '$lib/keyboard';
import {
    dateViewStore,
    notificationStore,
    preferencesStore,
    taskStore,
    uiStore,
} from '$lib/stores';

/** What a shortcut does. run() returns whether the key was consumed (the
 *  dispatcher preventDefaults only then). allowWhileTyping lifts the
 *  typing gate for modifier chords (Cmd/Ctrl+K stays Gmail-style). */
export interface KeyboardAction {
    run: () => boolean;
    allowWhileTyping?: boolean;
}

const TYPING_TARGETS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const PRIORITY_TAGS = ['p1', 'p2', 'p3'];
/** Elements whose native Space/Enter activation must not be stolen. */
const ACTIVATABLE = 'button, a, summary, [role="button"]';

function isTypingTarget(e: KeyboardEvent): boolean {
    const target = e.target as HTMLElement | null;
    return !!target && (TYPING_TARGETS.has(target.tagName) || target.isContentEditable);
}

/**
 * Space and Enter activate a focused control natively; the global
 * bindings must not steal them -- unless the control belongs to the
 * focused task's own row (clicking a row's checkbox or actions focuses
 * that task, and follow-up Space/Enter then act on it, which the
 * keyboard e2e suite relies on).
 */
function nativeActivationWins(e: KeyboardEvent): boolean {
    if (e.key !== ' ' && e.key !== 'Enter') return false;
    const target = e.target as HTMLElement | null;
    if (!target?.closest(ACTIVATABLE)) return false;
    const focusedId = uiStore.focusedTaskId;
    const row = focusedId ? document.getElementById(`task-${focusedId}`) : null;
    return row === null || !row.contains(target);
}

function getFocusedTask(): Task | undefined {
    const id = uiStore.focusedTaskId;
    return id ? taskStore.tasks.find(t => t.id === id) : undefined;
}

/** Move the focused task within its list: j/k navigates the day list,
 *  or the Someday panel when the focused task lives there. Returns
 *  whether keyboard focus was handled (so the caller can swallow the key). */
function moveFocus(delta: 1 | -1): boolean {
    const dayIds = uiStore.visibleTaskIds;
    const somedayIds = uiStore.visibleSomedayTaskIds;
    // The list that owns the current focus; falls back to the day list
    // (when nothing is focused yet, or focus is stale).
    const inSomeday =
        somedayIds.length > 0 && uiStore.focusedTaskId !== null
            ? somedayIds.includes(uiStore.focusedTaskId)
            : false;
    const ids = inSomeday ? somedayIds : dayIds.length > 0 ? dayIds : somedayIds;
    if (ids.length === 0) return false;
    const idx = uiStore.focusedTaskId ? ids.indexOf(uiStore.focusedTaskId) : -1;
    let next: number;
    if (idx === -1) {
        next = delta > 0 ? 0 : ids.length - 1;
    } else {
        next = Math.min(ids.length - 1, Math.max(0, idx + delta));
        if (next === idx) return true;
    }
    const id = ids[next];
    if (!id) return false;
    uiStore.focusTask(id);
    document.getElementById(`task-${id}`)?.scrollIntoView({ block: 'nearest' });
    return true;
}

function setPriorityTag(tag: 'p1' | 'p2' | 'p3' | null): boolean {
    const task = getFocusedTask();
    if (!task) return false;
    const tags = task.tags.filter(t => !PRIORITY_TAGS.includes(t));
    if (tag) tags.push(tag);
    taskStore.update(task.id, { tags });
    return true;
}

function deleteFocusedTask(): boolean {
    const task = getFocusedTask();
    if (!task) return false;
    const taskId = task.id;
    async function doDelete(): Promise<void> {
        const taskCopy = { ...task } as Task;
        const success = await taskStore.remove(taskId);
        if (success) {
            notificationStore.push('Task deleted', {
                kind: 'info',
                action: { label: 'Undo', fn: () => taskStore.restore(taskCopy) },
            });
        }
    }
    if (preferencesStore.deleteConfirmation === 'confirm') {
        if (window.confirm(`Delete "${task.text}"?`)) {
            void doDelete();
        }
    } else {
        void doDelete();
    }
    return true;
}

function openModal(modal: Parameters<typeof uiStore.openModal>[0]): boolean {
    uiStore.openModal(modal);
    return true;
}

/** Every shortcut in the registry, wired to its handler. The Record type
 *  makes an missing/extra entry a compile error. */
export const keyboardActions: Record<ShortcutId, KeyboardAction> = {
    focusNext: { run: () => moveFocus(1) },
    focusPrev: { run: () => moveFocus(-1) },
    addTask: {
        run: () => {
            uiStore.requestAddInputFocus(container.dateProvider.today());
            return true;
        },
    },
    editTask: {
        run: () => {
            if (!uiStore.focusedTaskId) return false;
            uiStore.startEditing(uiStore.focusedTaskId);
            return true;
        },
    },
    taskDetail: {
        run: () => {
            if (!uiStore.focusedTaskId) return false;
            uiStore.openModal('taskDetail');
            return true;
        },
    },
    toggleComplete: {
        run: () => {
            const task = getFocusedTask();
            if (!task) return false;
            void taskStore.update(task.id, { completed: !task.completed });
            return true;
        },
    },
    deleteTask: { run: deleteFocusedTask },
    // Popped from the undo history -- survives the toast (see
    // notificationStore). Blocked while typing so native text undo works.
    undo: { run: () => notificationStore.undoLatest() },
    setP1: { run: () => setPriorityTag('p1') },
    setP2: { run: () => setPriorityTag('p2') },
    setP3: { run: () => setPriorityTag('p3') },
    clearPriority: { run: () => setPriorityTag(null) },
    goToday: {
        run: () => {
            dateViewStore.requestScroll(container.dateProvider.today(), true);
            return true;
        },
    },
    // Deliberately usable while typing (Gmail-style Cmd+K):
    toggleSomedayPanel: {
        run: () => {
            if (preferencesStore.someDayPanelWidth === 0) {
                preferencesStore.setPanelWidth(preferencesStore.someDayPanelLastOpenWidth || 280);
            } else {
                preferencesStore.setPanelWidth(0);
            }
            return true;
        },
        allowWhileTyping: true,
    },
    search: { run: () => openModal('search'), allowWhileTyping: true },
    help: { run: () => openModal('help') },
    // Escape never reaches the matcher: handleGlobalKeydown gives it the
    // layered close behavior (modal, then inline edit, then add input).
    closeModal: { run: () => false },
    openSummary: { run: () => openModal('summary') },
    openProjects: { run: () => openModal('projects') },
    openHabits: { run: () => openModal('habits') },
    openCalendar: { run: () => openModal('calendar') },
    openFilter: { run: () => openModal('filter') },
    openTrash: { run: () => openModal('trash') },
    openSettings: { run: () => openModal('settings') },
};

const matcher = new KeybindingMatcher();

function toKeybindingEvent(e: KeyboardEvent): KeybindingEvent {
    return {
        key: e.key,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
        alt: e.altKey,
        shift: e.shiftKey,
    };
}

/** The svelte:window keydown handler: gates, then registry dispatch. */
export function handleGlobalKeydown(e: KeyboardEvent): void {
    // Escape layers: close the topmost thing -- a modal, an inline edit,
    // or an add input's focus.
    if (e.key === 'Escape') {
        uiStore.closeModal();
        uiStore.startEditing(null);
        const activeInput = document.activeElement;
        if (activeInput?.classList.contains('add-input')) {
            (activeInput as HTMLInputElement).blur();
        }
        matcher.cancel();
        return;
    }

    // No shortcuts under an open overlay.
    if (uiStore.activeModal) {
        matcher.cancel();
        return;
    }

    // Modifier chords work anywhere, including while typing in an input
    // (except undo, which defers to native text undo -- allowWhileTyping).
    if (e.metaKey || e.ctrlKey) {
        matcher.cancel();
        if (!e.altKey && !e.shiftKey) {
            const match = matcher.feed(toKeybindingEvent(e));
            if (match.status === 'action') {
                const action = keyboardActions[match.id];
                if (!isTypingTarget(e) || action.allowWhileTyping) {
                    e.preventDefault();
                    action.run();
                }
            }
        }
        return;
    }
    if (e.altKey) {
        matcher.cancel();
        return;
    }

    if (isTypingTarget(e)) {
        matcher.cancel();
        return;
    }

    // Space/Enter belong to a focused control outside the focused task's
    // row -- let the browser activate it natively.
    if (nativeActivationWins(e)) {
        matcher.cancel();
        return;
    }

    const match = matcher.feed(toKeybindingEvent(e));
    if (match.status === 'sequence-start') {
        // Swallow the chord prefix; the next key completes or cancels it.
        e.preventDefault();
        return;
    }
    if (match.status === 'action' && keyboardActions[match.id].run()) {
        e.preventDefault();
    }
}
