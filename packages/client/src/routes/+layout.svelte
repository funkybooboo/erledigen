<script lang="ts">
    import '../app.css';
    import { onMount } from 'svelte';
    import {
        connectionStore,
        preferencesStore,
        projectStore,
        someDayGroupStore,
        tagStore,
        uiStore,
        taskStore,
        notificationStore,
        dateViewStore,
    } from '$lib/stores';
    import type { Task } from '@erledigen/shared';
    import { container } from '$lib/container';
    import IconRail from '$lib/components/IconRail.svelte';
    import DateMinimap from '$lib/components/DateMinimap.svelte';
    import SomedayPanel from '$lib/components/SomedayPanel.svelte';
    import BottomBar from '$lib/components/BottomBar.svelte';
    import ModalHost from '$lib/components/ModalHost.svelte';
    import NotificationContainer from '$lib/components/NotificationContainer.svelte';

    let { children } = $props();

    function applyTheme(theme: 'light' | 'dark' | 'system') {
        let resolved: 'light' | 'dark';
        if (theme === 'system') {
            resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } else {
            resolved = theme;
        }
        document.documentElement.setAttribute('data-theme', resolved);
    }

    onMount(() => {
        preferencesStore.load().then(() => {
            applyTheme(preferencesStore.theme);
        });
        tagStore.fetchAll();
        projectStore.fetchAll();
        document.querySelector('.app-shell')?.setAttribute('data-hydrated', 'true');

        connectionStore.init();
        taskStore.initWebSocket();
        tagStore.initWebSocket();
        projectStore.initWebSocket();

        // Route uncaught errors through the shared logger so client-side
        // failures are visible in the console alongside server logs.
        const onError = (event: ErrorEvent) => {
            container.logger.error('Uncaught error', event.error ?? event.message);
        };
        const onRejection = (event: PromiseRejectionEvent) => {
            container.logger.error('Unhandled promise rejection', event.reason);
        };
        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (preferencesStore.theme === 'system') {
                applyTheme('system');
            }
        });

        return () => {
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
            connectionStore.destroy();
            taskStore.destroyWebSocket();
            tagStore.destroyWebSocket();
            projectStore.destroyWebSocket();
        };
    });

    $effect(() => {
        applyTheme(preferencesStore.theme);
    });

    // --- global keyboard shortcuts -------------------------------------
    // Bindings are documented once in lib/keybindings.ts (help modal +
    // hover tooltips render from that registry); this handler implements
    // them. Keep the two in sync.

    const TYPING_TARGETS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
    const PRIORITY_TAGS = ['p1', 'p2', 'p3'];

    function isTypingTarget(e: KeyboardEvent) {
        const target = e.target as HTMLElement | null;
        return !!target && (TYPING_TARGETS.has(target.tagName) || target.isContentEditable);
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
        const ids = inSomeday
            ? somedayIds
            : dayIds.length > 0
              ? dayIds
              : somedayIds;
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

    function setPriorityTag(task: Task, tag: 'p1' | 'p2' | 'p3' | null) {
        const tags = task.tags.filter(t => !PRIORITY_TAGS.includes(t));
        if (tag) tags.push(tag);
        taskStore.update(task.id, { tags });
    }

    function focusTodayAddInput() {
        const todayInput = document.querySelector(`#day-${container.dateProvider.today()} .add-input`) as HTMLElement | null;
        todayInput?.focus();
    }

    function deleteFocusedTask() {
        const task = getFocusedTask();
        if (!task) return;
        const taskId = task.id;
        async function doDelete() {
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
                doDelete();
            }
        } else {
            doDelete();
        }
    }

    function toggleSomedayPanel() {
        if (preferencesStore.someDayPanelWidth === 0) {
            preferencesStore.setPanelWidth(preferencesStore.someDayPanelLastOpenWidth || 280);
        } else {
            preferencesStore.setPanelWidth(0);
        }
    }

    /** Second keystroke of a "g <key>" sequence. */
    const GO_KEYS: Record<string, () => void> = {
        t: () => dateViewStore.requestScroll(container.dateProvider.today(), true),
        s: () => uiStore.openModal('summary'),
        p: () => uiStore.openModal('projects'),
        h: () => uiStore.openModal('habits'),
        c: () => uiStore.openModal('calendar'),
        f: () => uiStore.openModal('filter'),
        x: () => uiStore.openModal('trash'),
        o: () => uiStore.openModal('settings'),
    };

    let pendingG = false;
    let pendingGTimer: ReturnType<typeof setTimeout> | null = null;

    function clearPendingG() {
        pendingG = false;
        if (pendingGTimer) {
            clearTimeout(pendingGTimer);
            pendingGTimer = null;
        }
    }

    function setPendingG() {
        pendingG = true;
        if (pendingGTimer) clearTimeout(pendingGTimer);
        // Chords expire quickly -- a lone "g" should never swallow a later,
        // unrelated keypress.
        pendingGTimer = setTimeout(clearPendingG, 800);
    }

    function handleGlobalKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            uiStore.closeModal();
            uiStore.startEditing(null);
            const activeInput = document.activeElement;
            if (activeInput && activeInput.classList.contains('add-input')) {
                (activeInput as HTMLInputElement).blur();
            }
            clearPendingG();
            return;
        }

        if (uiStore.activeModal) {
            clearPendingG();
            return;
        }

        // Modifier chords work anywhere, including while typing in an input
        // (Gmail-style: Cmd/Ctrl+K hijacks the browser's address-bar focus).
        if (e.metaKey || e.ctrlKey) {
            if (!e.altKey && !e.shiftKey) {
                const key = e.key.toLowerCase();
                if (key === 'k') {
                    e.preventDefault();
                    uiStore.openModal('search');
                } else if (key === '\\') {
                    e.preventDefault();
                    toggleSomedayPanel();
                } else if (key === 'z' && !isTypingTarget(e)) {
                    // Undo runs the latest notification's action. Skipped
                    // while typing so the native text undo keeps working.
                    e.preventDefault();
                    notificationStore.undoLatest();
                }
            }
            clearPendingG();
            return;
        }
        if (e.altKey) {
            clearPendingG();
            return;
        }

        if (isTypingTarget(e)) {
            clearPendingG();
            return;
        }

        const key = e.key;

        // Second keystroke of a "g <key>" navigation sequence.
        if (pendingG) {
            const action = GO_KEYS[key.toLowerCase()];
            clearPendingG();
            if (action) {
                e.preventDefault();
                action();
            }
            return;
        }

        switch (key) {
            case 'j':
            case 'ArrowDown':
                if (moveFocus(1)) e.preventDefault();
                return;
            case 'k':
            case 'ArrowUp':
                if (moveFocus(-1)) e.preventDefault();
                return;
            case 'g':
                e.preventDefault();
                setPendingG();
                return;
            case 'n':
            case 'a':
                e.preventDefault();
                focusTodayAddInput();
                return;
            case '/':
                e.preventDefault();
                uiStore.openModal('search');
                return;
            case '?':
                e.preventDefault();
                uiStore.openModal('help');
                return;
            case 'e':
                if (uiStore.focusedTaskId) {
                    e.preventDefault();
                    uiStore.openModal('taskDetail');
                }
                return;
            case 'd':
                if (uiStore.focusedTaskId) {
                    e.preventDefault();
                    deleteFocusedTask();
                }
                return;
            case 'Enter': {
                const focusedId = uiStore.focusedTaskId;
                if (focusedId) {
                    e.preventDefault();
                    uiStore.startEditing(focusedId);
                }
                return;
            }
            case ' ': {
                const task = getFocusedTask();
                if (task) {
                    e.preventDefault();
                    taskStore.update(task.id, { completed: !task.completed });
                }
                return;
            }
            case '1':
            case '2':
            case '3': {
                const task = getFocusedTask();
                if (task) {
                    e.preventDefault();
                    setPriorityTag(task, `p${key}` as 'p1' | 'p2' | 'p3');
                }
                return;
            }
            case '0': {
                const task = getFocusedTask();
                if (task) {
                    e.preventDefault();
                    setPriorityTag(task, null);
                }
                return;
            }
        }
    }
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="app-shell" role="application" aria-label="Erledigen Task App">
    <a href="#main-content" class="skip-link">Skip to content</a>
    <div class="main-area">
        <IconRail />
        <DateMinimap />
        <main id="main-content" class="day-list-area">
            {@render children()}
        </main>
        <SomedayPanel />
    </div>
    <BottomBar />
</div>

<ModalHost />
<NotificationContainer />

<style>
    .app-shell {
        display: flex;
        flex-direction: column;
        height: 100vh;
        overflow: hidden;
    }

    .skip-link {
        position: absolute;
        top: -40px;
        left: 0;
        background: var(--color-accent);
        color: var(--color-on-accent);
        padding: 8px 16px;
        z-index: 200;
        font-size: 14px;
        text-decoration: none;
        border-radius: 0 0 4px 0;
    }

    .skip-link:focus {
        top: 0;
    }

    .main-area {
        display: flex;
        flex: 1;
        min-height: 0;
    }

    .day-list-area {
        flex: 1;
        min-width: 0;
        overflow-y: auto;
        transition: flex 0.2s ease;
        margin: 36px 0;
        box-sizing: border-box;
    }
</style>