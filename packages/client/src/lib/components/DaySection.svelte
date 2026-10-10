<script lang="ts">
    import TaskRow from './TaskRow.svelte';
    import InlineAddTask from './InlineAddTask.svelte';
    import SectionHeader from './SectionHeader.svelte';
    import DayNoteField from './DayNoteField.svelte';
    import { createNewlyCreatedTracker } from '$lib/newlyCreated.svelte';
    import { commitZoneDrop, zoneDragLeave, zoneDragOver } from '$lib/nndZone';
    import { snapInsertBeforeId } from '$lib/dragReorder';
    import type { Task, UpdateTaskInput } from '@erledigen/shared';
    import { container } from '$lib/container';
    import { dragStore, holidayStore, preferencesStore, taskStore, uiStore } from '$lib/stores';
    import { i18nStore } from '$lib/i18n/i18nStore.svelte';

    let { id, dateStr, label, tasks }: { id: string; dateStr: string; label: string; tasks: Task[] } = $props();

    const todayStr = $derived(preferencesStore.today);
    let isToday = $derived(dateStr === todayStr);
    let taskCount = $derived(tasks.length);
    let completedCount = $derived(tasks.filter(t => t.completed).length);

    // Distinct from the section's own `id` (day-{dateStr}, used as the
    // scroll/navigation target) -- duplicate DOM ids break getElementById
    // and Playwright's strict locators.
    let sectionId = $derived(`day-${dateStr}-header`);
    let dateParts = $derived(container.dateProvider.formatDateParts(dateStr));

    // Flash tracker for freshly created rows (shared helper: the SvelteSet
    // reactivity trap is documented in one place).
    let newlyCreated = createNewlyCreatedTracker();

    // Named dates on this day render as a banner strip above the
    // header (v0.9.0 holidays). Store read is reactive, so a Settings
    // add/import updates already-rendered sections immediately.
    let holidays = $derived(holidayStore.holidaysOn(dateStr));

    // Instance of the section's InlineAddTask, for the store-driven focus
    // request below (bind:this, no DOM queries).
    let addInput: InlineAddTask;

    // The global add-task binding (n/a) asks through the store; the section
    // whose date matches claims the request and focuses its input.
    $effect(() => {
        if (uiStore.consumeAddInputFocus(dateStr)) {
            addInput?.focusInput();
        }
    });

    function handleTaskCreated(id: string) {
        newlyCreated.add(id);
    }

    // --- drop zone (native HTML5 DnD) -----------------------------------

    let zoneId = $derived(`day:${dateStr}`);
    let isOver = $derived(dragStore.draggingTask !== null && dragStore.overZone === zoneId);
    /** Insertion line snaps to block boundaries (sub-tasks render
     *  glued to their parent, so "before a sub-task" means after the
     *  parent's whole block). */
    let indicatorBeforeId = $derived(
        isOver ? snapInsertBeforeId(tasks, dragStore.insertBeforeId) : null,
    );

    let listEl = $state<HTMLDivElement | undefined>(undefined);

    function handleDragOver(e: DragEvent) {
        zoneDragOver(zoneId, e, listEl);
    }

    function handleDragLeave(e: DragEvent) {
        // currentTarget is the section the handler is bound to.
        zoneDragLeave(zoneId, e, e.currentTarget as HTMLElement);
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        const dragged = dragStore.draggingTask;
        if (!dragged || dragStore.overZone !== zoneId) return;
        // Moving between days rides along with the position rewrite;
        // same-zone drops only touch positions.
        const baseInput: UpdateTaskInput = {};
        if (dragged.date !== dateStr) baseInput.date = dateStr;
        commitZoneDrop(tasks, dragged, baseInput, (id, input) => void taskStore.update(id, input));
    }
</script>

<section
    {id}
    class="day-section"
    class:today={isToday}
    class:drop-target={isOver}
    role="listitem"
    aria-label={label}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
>
    {#if holidays.length > 0}
        <div class="holiday-banner" aria-label={i18nStore.t('daySection.holidayBanner', { names: holidays.map(h => h.name).join(', ') })}>
            {holidays.map(h => h.name).join(' - ')}
        </div>
    {/if}
    <SectionHeader
        {sectionId}
        title={label}
        {dateParts}
        {taskCount}
        {completedCount}
        {isToday}
    />
    <!-- The day's margin note (v0.10.0): part of the day, never a task,
         collapsed when empty. -->
    <DayNoteField {dateStr} {label} />
    <div class="task-list" bind:this={listEl} role="list">
        {#each tasks as task (task.id)}
            <div
                class="task-row-wrapper"
                class:sub-task={task.parentId !== null}
                class:drop-before={indicatorBeforeId === task.id}
                data-task-id={task.id}
            >
                <TaskRow {task} isNew={newlyCreated.has(task.id)} />
            </div>
        {/each}
    </div>
    <InlineAddTask bind:this={addInput} date={dateStr} oncreated={handleTaskCreated} />
</section>

<style>
    .day-section {
        margin-bottom: 16px;
    }

    .day-section.today {
        background: var(--color-accent-light);
        margin: -8px -12px 16px -12px;
        padding: 8px 12px;
        border-radius: 8px;
    }

    /* Named-date banner above the header: a quiet accent strip that
       reads in both themes (token inversion, not a theme fork). */
    .holiday-banner {
        display: inline-block;
        margin-bottom: 4px;
        padding: 2px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        color: var(--color-accent);
        background: color-mix(in oklab, var(--color-accent) 10%, transparent);
        border: 1px solid color-mix(in oklab, var(--color-accent) 25%, transparent);
    }

    /* Drop-zone highlight while a drag hovers this day, and the 2px
       insertion line above the row the task would land before. */
    .day-section.drop-target {
        background: color-mix(in oklab, var(--color-accent) 7%, transparent);
        border-radius: 8px;
    }

    .task-row-wrapper.drop-before {
        box-shadow: inset 0 2px 0 0 var(--color-accent);
    }

    .task-list {
        display: flex;
        flex-direction: column;
    }

    /* Logical inset: sub-tasks indent toward the reading start, so an
       RTL locale mirrors the whole hierarchy (USE-15). */
    .task-row-wrapper.sub-task {
        margin-inline-start: 24px;
    }
</style>