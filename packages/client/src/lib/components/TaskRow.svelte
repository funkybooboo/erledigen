<script lang="ts">
    import { notificationStore, preferencesStore, dragStore, taskStore, uiStore } from '$lib/stores';
    import { deleteTaskWithUndo } from '$lib/taskActions';
    import { container } from '$lib/container';
    import {
        TASK_CONSTRAINTS,
        formatTags,
        parseTags,
        renderInlineMarkdown,
        resolveDatePhrase,
        type Task,
    } from '@erledigen/shared';
    import { Icon } from 'svelte-icons-pack';
    import {
        LuCheck,
        LuCircle,
        LuGripVertical,
        LuRepeat,
        LuFileText,
        LuStickyNote,
        LuX,
    } from 'svelte-icons-pack/lu';
    import { onDestroy, untrack } from 'svelte';
    import { tooltip } from '$lib/tooltip';
    import { tagChipStyle } from '$lib/tagColors';

    let { task, isNew = false }: { task: Task; isNew?: boolean } = $props();

    let isEditing = $derived(uiStore.editingTaskId === task.id);
    let isFocused = $derived(uiStore.focusedTaskId === task.id);
    let hasStartTime = $derived(task.startTime !== null);
    let titleHtml = $derived(renderInlineMarkdown(task.text));
    let hasNotes = $derived(task.notes !== null && task.notes.trim() !== '');

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

    // --- completion flash (USE-6) ----------------------------------------
    // A brief success-tinted pulse when this row's completed flag flips
    // false -> true: the visual acknowledgment of finishing something.
    // Plain (non-$state) previous value: the effect tracks task.completed,
    // compares against what it saw last run, and re-arms per flip.
    // Seeding with the INITIAL prop value is the point.
    // svelte-ignore state_referenced_locally
    let previousCompleted = task.completed;
    let justCompleted = $state(false);
    let completedTimer: ReturnType<typeof setTimeout> | null = null;
    $effect(() => {
        // The user's motion preference gates the pulse (USE-7): reading it
        // here makes the effect re-run on preference changes, which is a
        // no-op for the flip tracking (now === before then).
        void preferencesStore.completionAnimation;
        const now = task.completed;
        const before = previousCompleted;
        previousCompleted = now;
        if (now && !before && preferencesStore.completionAnimation === 'flash') {
            justCompleted = true;
            if (completedTimer) clearTimeout(completedTimer);
            completedTimer = setTimeout(() => {
                justCompleted = false;
                completedTimer = null;
            }, 600);
        }
    });

    onDestroy(() => {
        if (completedTimer) clearTimeout(completedTimer);
    });

    $effect(() => {
        if (isEditing) {
            editText = task.text;
        }
    });

    // Seed and focus a sub-editor when the store request targets this
    // row. The seed happens ONCE per editor request: the effect re-runs
    // whenever the task prop is replaced (a slow update response or a WS
    // ingest landing mid-edit), and re-seeding then would wipe the
    // typing. Only the focus (idempotent) repeats on re-runs.
    let seededEditor = $state<string | null>(null);

    $effect(() => {
        if (uiStore.rowEditor?.taskId === task.id && uiStore.rowEditor.kind === 'date') {
            const seedKey = `${task.id}:date`;
            if (seededEditor !== seedKey) {
                seededEditor = seedKey;
                dateValue = untrack(() => task.date ?? '');
            }
            dateInput?.focus();
        }
    });

    $effect(() => {
        if (uiStore.rowEditor?.taskId === task.id && uiStore.rowEditor.kind === 'tags') {
            const seedKey = `${task.id}:tags`;
            if (seededEditor !== seedKey) {
                seededEditor = seedKey;
                tagsValue = untrack(() => formatTags(task.tags));
            }
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

    function startEdit(e: MouseEvent) {
        // A rendered link inside the title follows the link; every other
        // click opens the raw-syntax edit (the live model: the line
        // under the caret shows source).
        if (e.target instanceof HTMLAnchorElement) return;
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

    // --- drag to move (native HTML5 DnD, v0.6.0 reactivated design) ----

    // The row is draggable only while the grip is held: a permanently
    // draggable row hijacks mousedown and breaks text selection. The
    // grip's pointerdown arms the row before the drag gesture can
    // start, and pointerup (a grip press without a drag) disarms it.
    // Sub-tasks never drag: they render glued to their parent, so a
    // cross-day sub-task move would have no visible effect -- the
    // keyboard alternatives (r/m inline editors) stay the move path.
    let dragArmed = $state(false);
    let isDraggable = $derived(dragArmed && task.parentId === null);

    function handleDragStart(e: DragEvent) {
        if (!isDraggable) {
            e.preventDefault();
            return;
        }
        dragStore.start(task);
        e.dataTransfer?.setData('text/plain', task.id);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    }

    function handleDragEnd() {
        dragArmed = false;
        dragStore.clear();
    }
</script>

<div
    class="task-row"
    class:completed={task.completed}
    class:just-completed={justCompleted}
    class:task-new={isNew}
    class:focused={isFocused}
    class:is-recurring={Boolean(task.recurringTaskId)}
    class:prio-1={priorityAccent === 'prio-1'}
    class:prio-2={priorityAccent === 'prio-2'}
    class:prio-3={priorityAccent === 'prio-3'}
    class:dragging={dragStore.isDragging(task.id)}
    id="task-{task.id}"
    draggable={isDraggable}
    role="listitem"
    ondragstart={handleDragStart}
    ondragend={handleDragEnd}
    aria-label="{task.text}{task.completed ? ', completed' : ''}"
>
    {#if task.parentId === null && !isEditing}
        <!-- Mouse-only by design: keyboard users move tasks with the
             r/m inline editors (v0.5.0), so the grip needs no key path. -->
        <span
            class="drag-grip"
            aria-hidden="true"
            onpointerdown={() => (dragArmed = true)}
            onpointerup={() => (dragArmed = false)}
            use:tooltip={{ label: 'Drag to move' }}
        >
            <Icon src={LuGripVertical} />
        </span>
    {/if}
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
            aria-label="Edit task text"
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
        <button class="task-text" aria-label={task.text} onclick={startEdit} use:tooltip={'editTask'}>
            {#if hasStartTime}
                <span class="time-badge">{task.startTime}</span>
            {/if}
            <span class="md-root title-markdown">{@html titleHtml}</span>
        </button>
    {/if}

    <div class="task-meta">
        {#if hasNotes}
            <span class="has-notes" use:tooltip={{ label: 'Has notes' }}>
                <Icon src={LuStickyNote} />
            </span>
        {/if}
        {#if task.recurringTaskId}
            <span class="recurring-icon" use:tooltip={{ label: 'Recurring habit instance' }}>
                <Icon src={LuRepeat} />
            </span>
        {/if}

        {#each task.tags as tag (tag)}
            <span class="tag-chip" style={tagChipStyle(tag)}>#{tag}</span>
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
        padding: var(--row-pad-y) 4px;
        border-radius: 6px;
        transition: background-color 0.1s;
        min-height: var(--row-min-h);
    }

    .task-row:hover {
        background: var(--color-surface-hover);
    }

    .task-row.dragging {
        opacity: 0.45;
    }

    .drag-grip {
        display: flex;
        align-items: center;
        padding: 2px;
        flex-shrink: 0;
        color: var(--color-text-secondary);
        cursor: grab;
        opacity: 0;
        transition: opacity 0.15s, color 0.15s;
    }

    .task-row:hover .drag-grip,
    .task-row.dragging .drag-grip {
        opacity: 1;
    }

    .drag-grip:hover {
        color: var(--color-text);
    }

    .drag-grip:active {
        cursor: grabbing;
    }

    .drag-grip :global(svg) {
        width: 14px;
        height: 14px;
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
        color: var(--color-text-secondary);
    }

    .task-new {
        animation: task-flash 500ms ease-out;
    }

    @keyframes task-flash {
        from { background: var(--color-accent-light); }
        to { background: transparent; }
    }

    /* Completion flash (USE-6): a success-tinted pulse when the task's
       completed flag flips on. The prefers-reduced-motion block in
       app.css collapses it to a no-op when the OS asks for stillness. */
    .task-row.just-completed {
        animation: complete-flash 600ms ease-out;
    }

    @keyframes complete-flash {
        from { background: var(--color-success-light); }
        to { background: transparent; }
    }

    .checkbox {
        background: none;
        border: none;
        cursor: pointer;
        padding: 2px;
        line-height: 1;
        color: var(--color-text-secondary);
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
        font-size: var(--fs-body);
        color: var(--color-text);
        cursor: text;
        min-width: 0;
        text-align: left;
    }

    /* Live-markdown titles (v0.10.0): the md-root wrapper carries the
       shared inline styles; headings read as bold section titles --
       the groundwork for the v0.17.0 "# Morning" section tasks. */
    .title-markdown {
        font-size: var(--fs-body);
        line-height: inherit;
    }

    .title-markdown :global(h1),
    .title-markdown :global(h2),
    .title-markdown :global(h3),
    .title-markdown :global(h4),
    .title-markdown :global(h5),
    .title-markdown :global(h6) {
        display: inline;
        font-size: calc(var(--fs-body) + 0.5px);
        font-weight: 650;
        margin: 0;
    }

    .edit-input {
        flex: 1;
        font-size: var(--fs-body);
        padding: 2px 4px;
        border: 1px solid var(--color-accent);
        border-radius: 6px;
        outline: none;
        background: var(--color-surface);
        color: var(--color-text);
    }

    .time-badge {
        font-size: var(--fs-micro);
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

    /* Has-notes marker (UX-audit finding, v0.10.0): a quiet sticky note
       so a task's notes are discoverable without opening the detail. */
    .has-notes {
        display: flex;
        color: var(--color-text-secondary);
    }

    .has-notes :global(svg) {
        width: 12px;
        height: 12px;
    }

    .tag-chip {
        font-size: var(--fs-chip);
        padding: 1px 6px;
        border-radius: 10px;
        background: var(--color-surface-hover);
        color: var(--color-text-secondary);
        border: 1px solid transparent;
    }

    /* A colored chip (tagChipStyle inline) keeps its token colors; the
       inline style overrides background/color/border-color wholesale. */

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