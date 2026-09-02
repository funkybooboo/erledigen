<script lang="ts">
    import TaskRow from './TaskRow.svelte';
    import InlineAddTask from './InlineAddTask.svelte';
    import SectionHeader from './SectionHeader.svelte';
    import { SvelteSet } from 'svelte/reactivity';
    import type { Task } from '@erledigen/shared';
    import { container } from '$lib/container';
    import { preferencesStore, uiStore } from '$lib/stores';

    let { id, dateStr, label, tasks }: { id: string; dateStr: string; label: string; tasks: Task[] } = $props();

    const todayStr = $derived.by(() => {
        preferencesStore.timezone;
        return container.dateProvider.today();
    });
    let isToday = $derived(dateStr === todayStr);
    let taskCount = $derived(tasks.length);
    let completedCount = $derived(tasks.filter(t => t.completed).length);

    // Distinct from the section's own `id` (day-{dateStr}, used as the
    // scroll/navigation target) -- duplicate DOM ids break getElementById
    // and Playwright's strict locators.
    let sectionId = $derived(`day-${dateStr}-header`);
    let dateParts = $derived(container.dateProvider.formatDateParts(dateStr));

    // SvelteSet (not $state<Set>): Svelte 5 deep-proxies only plain
    // objects/arrays, so .add()/.delete() on a raw Set never signals and
    // the 600ms expiry below would leave the flash class on until an
    // unrelated re-render. Same trap the recurring stats Map hit.
    let newlyCreatedIds = new SvelteSet<string>();

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
        newlyCreatedIds.add(id);
        setTimeout(() => newlyCreatedIds.delete(id), 600);
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
                <TaskRow {task} isNew={newlyCreatedIds.has(task.id)} />
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