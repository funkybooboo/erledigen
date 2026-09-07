<script lang="ts">
    import TaskRow from './TaskRow.svelte';
    import InlineAddTask from './InlineAddTask.svelte';
    import SectionHeader from './SectionHeader.svelte';
    import { createNewlyCreatedTracker } from '$lib/newlyCreated.svelte';
    import type { Task } from '@erledigen/shared';
    import { container } from '$lib/container';
    import { preferencesStore, uiStore } from '$lib/stores';

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
</script>

<section {id} class="day-section" class:today={isToday} role="listitem" aria-label={label}>
    <SectionHeader
        {sectionId}
        title={label}
        {dateParts}
        {taskCount}
        {completedCount}
        {isToday}
    />
    <div class="task-list" role="list">
        {#each tasks as task (task.id)}
            <div class="task-row-wrapper" class:sub-task={task.parentId !== null}>
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

    .task-list {
        display: flex;
        flex-direction: column;
    }

    .task-row-wrapper.sub-task {
        margin-left: 24px;
    }
</style>