<script lang="ts">
    /**
     * NotesModal -- the global view over every note (v0.10.0).
     *
     * A LENS, never an owner (system rule 8): it reads and edits the
     * notes that already exist, grouped by their owner -- day sections
     * in date order, each day's day note plus the notes of the tasks
     * scheduled on it, with undated (Someday) task notes at the end.
     * It never creates standalone notes; every entry edits its owner's
     * note in place and offers a hop back (the day in the list, the
     * task's detail).
     */

    import Modal from '$lib/components/Modal.svelte';
    import LiveMarkdownEditor from '$lib/components/LiveMarkdownEditor.svelte';
    import DayNoteField from '$lib/components/DayNoteField.svelte';
    import { dateViewStore, dayNoteStore, taskStore, uiStore } from '$lib/stores';
    import { container } from '$lib/container';
    import type { Task } from '@erledigen/shared';
    import { Icon } from 'svelte-icons-pack';
    import { LuArrowRight, LuFileText } from 'svelte-icons-pack/lu';

    let { onclose = () => {} }: { onclose?: () => void } = $props();

    const SAVE_DEBOUNCE_MS = 800;

    interface DayGroup {
        /** null = the Someday group (undated tasks). */
        date: string | null;
        label: string;
        tasks: Task[];
    }

    let groups = $derived.by(() => {
        const tasksByDate = new Map<string, Task[]>();
        for (const task of taskStore.tasks) {
            if (task.notes === null || task.notes.trim() === '') continue;
            const key = task.date ?? '__someday__';
            const bucket = tasksByDate.get(key) ?? [];
            bucket.push(task);
            tasksByDate.set(key, bucket);
        }

        const dates = new Set<string>(tasksByDate.keys());
        for (const note of dayNoteStore.items) dates.add(note.date);

        const result: DayGroup[] = [];
        for (const date of [...dates].sort()) {
            if (date === '__someday__') continue;
            result.push({
                date,
                label: container.dateProvider.formatDate(date, 'full'),
                tasks: tasksByDate.get(date) ?? [],
            });
        }
        if (tasksByDate.has('__someday__')) {
            result.push({
                date: null,
                label: 'Someday',
                tasks: tasksByDate.get('__someday__') ?? [],
            });
        }
        return result;
    });

    let hasDayNote = $derived.by(() => {
        const dates = new Set<string>();
        for (const note of dayNoteStore.items) dates.add(note.date);
        return dates;
    });

    /** A group renders when it owns a day note or holds tasks with
     *  notes -- the modal never invents entries. */
    function groupVisible(group: DayGroup): boolean {
        return (
            (group.date !== null && hasDayNote.has(group.date)) || group.tasks.length > 0
        );
    }

    // --- task-note drafts (edit in place, debounced save) -----------

    interface Draft {
        text: string;
        dirty: boolean;
        timer: ReturnType<typeof setTimeout> | null;
    }

    let drafts = $state<Record<string, Draft>>({});

    function draftValue(task: Task): string {
        return drafts[task.id]?.text ?? task.notes ?? '';
    }

    function handleTaskNoteChange(task: Task, value: string): void {
        const draft = drafts[task.id] ?? { text: '', dirty: false, timer: null };
        draft.text = value;
        draft.dirty = true;
        if (draft.timer) clearTimeout(draft.timer);
        draft.timer = setTimeout(() => {
            void commitTaskNote(task.id);
        }, SAVE_DEBOUNCE_MS);
        drafts[task.id] = draft;
    }

    async function commitTaskNote(taskId: string): Promise<void> {
        const draft = drafts[taskId];
        if (!draft || !draft.dirty) return;
        // Snapshot before awaiting (the repo's async-handler rule).
        const value = draft.text;
        const task = taskStore.tasks.find(t => t.id === taskId);
        if (!task) return;

        const updated =
            value.trim() === ''
                ? await taskStore.update(taskId, { notes: null })
                : await taskStore.update(taskId, { notes: value });
        // A clean round-trip retires the draft; a newer local edit keeps
        // it sovereign over the WS echo of this save.
        if (updated !== null && draft.text === value) {
            if (draft.timer) clearTimeout(draft.timer);
            delete drafts[taskId];
        }
    }

    // --- hop back -----------------------------------------------------

    function hopToDay(date: string): void {
        dateViewStore.requestScroll(date, true);
        uiStore.closeModal();
    }

    function hopToTask(task: Task): void {
        uiStore.focusTask(task.id);
        uiStore.openModal('taskDetail');
    }
</script>

<Modal title="Notes" onclose={onclose}>
    <div class="notes-modal">
        {#if groups.filter(groupVisible).length === 0}
            <p class="empty">
                No notes anywhere yet. Write one on a day (its margin) or open a task's
                details -- every note lives attached to a day or a task.
            </p>
        {:else}
            {#each groups as group (group.date ?? 'someday')}
                {#if groupVisible(group)}
                    <section class="day-group">
                        <h3 class="modal-section-heading group-heading">
                            {group.label}
                        </h3>

                        {#if group.date !== null && hasDayNote.has(group.date)}
                            <div class="entry day-note-entry">
                                <DayNoteField dateStr={group.date} label={group.label} />
                                <button
                                    class="hop-btn"
                                    onclick={() => hopToDay(group.date ?? '')}
                                    aria-label="Show this day in the list"
                                >
                                    day
                                    <Icon src={LuArrowRight} />
                                </button>
                            </div>
                        {/if}

                        {#each group.tasks as task (task.id)}
                            <div class="entry" class:sub-task={task.parentId !== null}>
                                <div class="entry-owner">
                                    <span class="owner-icon"><Icon src={LuFileText} /></span>
                                    <span class="owner-text" class:completed={task.completed}>
                                        {task.text}
                                    </span>
                                    <button
                                        class="hop-btn"
                                        onclick={() => hopToTask(task)}
                                        aria-label="Open {task.text} details"
                                    >
                                        task
                                        <Icon src={LuArrowRight} />
                                    </button>
                                </div>
                                <LiveMarkdownEditor
                                    value={draftValue(task)}
                                    onchange={value => handleTaskNoteChange(task, value)}
                                    placeholder="Write a note..."
                                    ariaLabel="Notes for {task.text}"
                                />
                            </div>
                        {/each}
                    </section>
                {/if}
            {/each}
        {/if}
    </div>
</Modal>

<style>
    .notes-modal {
        display: flex;
        flex-direction: column;
        gap: 14px;
    }

    .empty {
        color: var(--color-text-secondary);
        font-size: 14px;
        text-align: center;
        padding: 16px 0;
    }

    .day-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .group-heading {
        margin: 0;
        border-bottom: 1px solid var(--color-border);
        padding-bottom: 4px;
    }

    .entry {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px 10px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        background: var(--color-surface-dim);
    }

    .entry.sub-task {
        margin-left: 16px;
    }

    .day-note-entry {
        display: flex;
        align-items: flex-start;
        border: none;
        background: none;
        padding: 0;
    }

    .day-note-entry :global(.day-note) {
        flex: 1;
        min-width: 0;
    }

    .entry-owner {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }

    .owner-icon {
        color: var(--color-text-muted);
        flex-shrink: 0;
    }

    .owner-icon :global(svg) {
        width: 13px;
        height: 13px;
    }

    .owner-text {
        flex: 1;
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .owner-text.completed {
        text-decoration: line-through;
        color: var(--color-text-secondary);
    }

    .hop-btn {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        flex-shrink: 0;
        border: none;
        border-radius: 999px;
        padding: 2px 8px;
        background: none;
        color: var(--color-text-secondary);
        font-size: 11px;
        cursor: pointer;
        transition: color 0.15s, background-color 0.15s;
    }

    .hop-btn :global(svg) {
        width: 11px;
        height: 11px;
    }

    .hop-btn:hover {
        color: var(--color-accent);
        background: var(--color-accent-light);
    }

    .hop-btn:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
    }

    .entry :global(.live-markdown) {
        font-size: 13px;
        color: var(--color-text-secondary);
    }
</style>