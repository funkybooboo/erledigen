<script lang="ts">
    import { notificationStore, preferencesStore, taskStore, uiStore } from '$lib/stores';
    import { deleteTaskWithUndo } from '$lib/taskActions';
    import { container } from '$lib/container';
    import {
        TASK_CONSTRAINTS,
        formatTags,
        parseTags,
        resolveDatePhrase,
        type Task,
    } from '@erledigen/shared';
    import { Icon } from 'svelte-icons-pack';
    import { LuCheck, LuCircle, LuRepeat, LuFileText, LuX } from 'svelte-icons-pack/lu';
    import { tooltip } from '$lib/tooltip';

    let { task, isNew = false }: { task: Task; isNew?: boolean } = $props();

    let isEditing = $derived(uiStore.editingTaskId === task.id);
    let isFocused = $derived(uiStore.focusedTaskId === task.id);
    let hasStartTime = $derived(task.startTime !== null);

    /** Subtle left-border accent per priority, only while the priority
     *  sort mode is active (Filter modal) -- the roadmap's visual cue. */
    let priorityAccent = $derived.by(() => {
        if (preferencesStore.activeFilters.sortMode !== 'priority') return null;
        if (task.tags.includes('p1')) return 'prio-1';
        if (task.tags.includes('p2')) return 'prio-2';
        if (task.tags.includes('p3')) return 'prio-3';
        return null;
    });

    // The r/m/t keyboard actions open row-level sub-editors through the
    // same store-driven pattern as the text edit (editingTaskId).
    let rowEditor = $derived(
        uiStore.rowEditor?.taskId === task.id ? uiStore.rowEditor : null,
    );
    let isEditingDate = $derived(rowEditor?.kind === 'date');
    let isEditingTags = $derived(rowEditor?.kind === 'tags');

    let editText = $state('');
    let editInput = $state<HTMLInputElement | undefined>(undefined);
    let dateValue = $state('');
    let dateInput = $state<HTMLInputElement | undefined>(undefined);
    let tagsValue = $state('');
    let tagsInput = $state<HTMLInputElement | undefined>(undefined);

    $effect(() => {
        if (isEditing) {
            editText = task.text;
        }
    });

    // Seed and focus a sub-editor when the store request targets this row.
    $effect(() => {
        if (isEditingDate) {
            dateValue = task.date ?? '';
            dateInput?.focus();
        }
    });

    $effect(() => {
        if (isEditingTags) {
            tagsValue = formatTags(task.tags);
            tagsInput?.focus();
        }
    });

    $effect(() => {
        if (uiStore.editingTaskId === task.id && editInput) {
            editInput.focus();
        }
    });

    // Acting on a row (checkbox, edit, delete, details) also makes it the
    // focused task so follow-up keyboard shortcuts (Space, d, 1-3, Enter)
    // target the row the user just touched with the mouse.
    function handleCheckboxChange() {
        uiStore.focusTask(task.id);
        taskStore.update(task.id, { completed: !task.completed });
    }

    function startEdit() {
        uiStore.focusTask(task.id);
        uiStore.startEditing(task.id);
    }

    function commitEdit() {
        if (editText.trim() && editText.trim() !== task.text) {
            taskStore.update(task.id, { text: editText.trim() });
        }
        uiStore.startEditing(null);
    }

    function cancelEdit() {
        uiStore.startEditing(null);
        editText = task.text;
    }

    function handleEditKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    }

    // --- inline reschedule editor (r / m) ------------------------------

    function commitDateEdit() {
        const value = dateValue.trim();
        uiStore.closeRowEditor();
        if (!value || value === (task.date ?? '')) return;
        // "someday" clears the date (Someday panel); anything else must parse
        // date phrase ("tomorrow", "next monday", "2026-10-15", ...).
        if (value.toLowerCase() === 'someday') {
            void taskStore.update(task.id, { date: null });
            return;
        }
        const date = resolveDatePhrase(value, container.dateProvider.today());
        if (!date) {
            notificationStore.push(`Could not parse "${value}" as a date`, {
                kind: 'error',
            });
            return;
        }
        void taskStore.update(task.id, { date });
    }

    function handleDateKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitDateEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            uiStore.closeRowEditor();
        }
    }

    // --- inline tags editor (t) ----------------------------------------

    function commitTagsEdit() {
        const tags = parseTags(tagsValue);
        if (tags.join(',') !== task.tags.join(',')) {
            void taskStore.update(task.id, { tags });
        }
        uiStore.closeRowEditor();
    }

    function handleTagsKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitTagsEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            uiStore.closeRowEditor();
        }
    }

    function openDetail() {
        uiStore.focusTask(task.id);
        uiStore.openModal('taskDetail');
    }

    async function handleDelete() {
        uiStore.focusTask(task.id);
        await deleteTaskWithUndo(task);
    }
</script>

<div
    class="task-row"
    class:completed={task.completed}
    class:task-new={isNew}
    class:focused={isFocused}
    class:is-recurring={Boolean(task.recurringTaskId)}
    class:prio-1={priorityAccent === 'prio-1'}
    class:prio-2={priorityAccent === 'prio-2'}
    class:prio-3={priorityAccent === 'prio-3'}
    id="task-{task.id}"
    aria-label="{task.text}{task.completed ? ', completed' : ''}"
>
    <button
        class="checkbox"
        class:checked={task.completed}
        onclick={handleCheckboxChange}
        use:tooltip={{ label: task.completed ? 'Mark incomplete' : 'Mark complete', shortcut: 'toggleComplete' }}
        aria-label="{task.completed ? 'Mark incomplete' : 'Mark complete'}"
        aria-pressed={task.completed}
    >
        {#if task.completed}
            <Icon src={LuCheck} />
        {:else}
            <Icon src={LuCircle} />
        {/if}
    </button>

    {#if isEditing}
        <input
            bind:this={editInput}
            bind:value={editText}
            class="edit-input"
            onkeydown={handleEditKeydown}
            onblur={commitEdit}
            maxlength={TASK_CONSTRAINTS.MAX_TEXT_LENGTH}
        />
    {:else if isEditingDate}
        <input
            bind:this={dateInput}
            bind:value={dateValue}
            class="edit-input"
            placeholder='Date -- "tomorrow", "next monday", "2026-10-15", or "someday"'
            aria-label="Reschedule task"
            onkeydown={handleDateKeydown}
            onblur={commitDateEdit}
        />
    {:else if isEditingTags}
        <input
            bind:this={tagsInput}
            bind:value={tagsValue}
            class="edit-input"
            placeholder="Tags, comma-separated"
            aria-label="Edit task tags"
            onkeydown={handleTagsKeydown}
            onblur={commitTagsEdit}
        />
    {:else}
        <button class="task-text" onclick={startEdit} use:tooltip={'editTask'}>
            {#if hasStartTime}
                <span class="time-badge">{task.startTime}</span>
            {/if}
            {task.text}
        </button>
    {/if}

    <div class="task-meta">
        {#if task.recurringTaskId}
            <span class="recurring-icon" use:tooltip={{ label: 'Recurring habit instance' }}>
                <Icon src={LuRepeat} />
            </span>
        {/if}

        {#each task.tags as tag}
            <span class="tag-chip">#{tag}</span>
        {/each}
    </div>

    <div class="task-actions">
        <button class="action-btn" onclick={openDetail} use:tooltip={'taskDetail'} aria-label="Task details">
            <Icon src={LuFileText} />
        </button>
        <button class="action-btn danger" onclick={handleDelete} use:tooltip={'deleteTask'} aria-label="Delete task">
            <Icon src={LuX} />
        </button>
    </div>
</div>

<style>
    .task-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 4px;
        border-radius: 6px;
        transition: background-color 0.1s;
        min-height: 36px;
    }

    .task-row:hover {
        background: var(--color-surface-hover);
    }

    /* Keyboard-focused task (j/k navigation): accent tint so it is visibly
       the target of the next single-key action (Space, d, e, 1-3...). */
    .task-row.focused {
        background: var(--color-accent-light);
    }

    .task-row.focused:hover {
        background: var(--color-accent-light);
    }

    /* Habit instances carry their template's accent as a hairline left
       bar, echoing the repeat icon: visible linkage beyond the icon alone,
       but quiet enough to stay out of the way. */
    .task-row.is-recurring {
        box-shadow: inset 2px 0 0 color-mix(in oklab, var(--color-accent) 65%, transparent);
    }

    .task-row.is-recurring .recurring-icon {
        color: var(--color-accent);
    }

    /* Priority accents (Filter modal's Priority sort mode): the same
       hairline treatment as the recurring bar, keyed by urgency. */
    .task-row.prio-1 {
        box-shadow: inset 2px 0 0 color-mix(in oklab, var(--color-danger) 65%, transparent);
    }

    .task-row.prio-2 {
        box-shadow: inset 2px 0 0 color-mix(in oklab, var(--color-warning) 65%, transparent);
    }

    .task-row.prio-3 {
        box-shadow: inset 2px 0 0 color-mix(in oklab, var(--color-accent) 65%, transparent);
    }

    .task-row.completed .task-text {
        text-decoration: line-through;
        color: var(--color-text-muted);
    }

    .task-new {
        animation: task-flash 500ms ease-out;
    }

    @keyframes task-flash {
        from { background: var(--color-accent-light); }
        to { background: transparent; }
    }

    .checkbox {
        background: none;
        border: none;
        cursor: pointer;
        padding: 2px;
        line-height: 1;
        color: var(--color-text-muted);
        transition: color 0.15s;
        flex-shrink: 0;
    }

    .checkbox :global(svg) {
        width: 16px;
        height: 16px;
    }

    .checkbox:hover {
        color: var(--color-accent);
    }

    .checkbox.checked {
        color: var(--color-success);
    }

    .checkbox:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
        border-radius: 2px;
    }

    .task-text {
        flex: 1;
        font-size: 14px;
        color: var(--color-text);
        cursor: text;
        min-width: 0;
        text-align: left;
    }

    .edit-input {
        flex: 1;
        font-size: 14px;
        padding: 2px 4px;
        border: 1px solid var(--color-accent);
        border-radius: 6px;
        outline: none;
        background: var(--color-surface);
        color: var(--color-text);
    }

    .time-badge {
        font-size: 12px;
        font-family: monospace;
        color: var(--color-text-secondary);
        margin-right: 6px;
        background: var(--color-surface-hover);
        padding: 1px 4px;
        border-radius: 3px;
    }

    .task-meta {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
    }

    .recurring-icon :global(svg) {
        width: 13px;
        height: 13px;
    }

    .tag-chip {
        font-size: 11px;
        padding: 1px 6px;
        border-radius: 10px;
        background: var(--color-surface-hover);
        color: var(--color-text-secondary);
    }

    .task-actions {
        display: flex;
        gap: 2px;
        opacity: 0;
        transition: opacity 0.15s;
        flex-shrink: 0;
    }

    .task-row:hover .task-actions {
        opacity: 1;
    }

    .action-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 6px;
        color: var(--color-text-secondary);
        transition: background-color 0.15s, color 0.15s;
    }

    .action-btn :global(svg) {
        width: 14px;
        height: 14px;
    }

    .action-btn:hover {
        background: var(--color-surface-hover);
        color: var(--color-text);
    }

    .action-btn.danger:hover {
        background: var(--color-danger-light);
        color: var(--color-danger);
    }

    .action-btn:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: -2px;
    }
</style>