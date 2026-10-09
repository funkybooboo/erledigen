<script lang="ts">
    import { Icon } from 'svelte-icons-pack';
    import { LuLock, LuX } from 'svelte-icons-pack/lu';
    import { container } from '$lib/container';
    import { dragStore, projectStore, taskStore, uiStore } from '$lib/stores';
    import {
        distributionWindowStart,
        planProjectDistribution,
        type DistributionAssignment,
        type Project,
        type Task,
    } from '@erledigen/shared';

    /**
     * Project-detail Kanban board (v0.9.0): three columns mapped onto
     * REAL domain state rather than the unused `state` field, so every
     * drag is a meaningful mutation:
     *
     *   Ready     -- no date, not completed (the project's backlog)
     *   Scheduled -- has a date (the card shows + edits it inline)
     *   Done      -- completed
     *
     * Sub-tasks stay off the board: they render glued to their parent in
     * the day list, so a lone sub-task move would have no visible effect
     * (the same reason they are not draggable there).
     */
    interface Props {
        project: Project;
        /** The project's tasks (those carrying its `project:` tag). */
        tasks: Task[];
    }
    let { project, tasks }: Props = $props();

    let today = $derived(container.dateProvider.today());

    let topLevel = $derived(tasks.filter(t => t.parentId === null));
    let ready = $derived(topLevel.filter(t => !t.completed && t.date === null));
    let scheduled = $derived(topLevel.filter(t => !t.completed && t.date !== null));
    let done = $derived(topLevel.filter(t => t.completed));

    const columns = [
        { id: 'ready', title: 'Ready' },
        { id: 'scheduled', title: 'Scheduled' },
        { id: 'done', title: 'Done' },
    ] as const;
    type ColumnId = (typeof columns)[number]['id'];

    function columnTasks(id: ColumnId): Task[] {
        return id === 'ready' ? ready : id === 'scheduled' ? scheduled : done;
    }

    // --- drag between columns (native HTML5 DnD on the v0.6.0 store) ---

    /** Date a Ready -> Scheduled drop assigns; adjustable inline on the
     *  card afterwards. Never in the past. */
    let scheduledDropDate = $derived(
        distributionWindowStart({ startDate: project.startDate, dueDate: project.dueDate, today }),
    );

    function columnDragOver(id: ColumnId, e: DragEvent): void {
        if (!dragStore.draggingTask) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        dragStore.hover(`kanban:${id}`, null);
    }

    function columnDragLeave(id: ColumnId, e: DragEvent): void {
        const next = e.relatedTarget;
        if (next instanceof Node && e.currentTarget instanceof Node && e.currentTarget.contains(next))
            return;
        if (dragStore.overZone === `kanban:${id}`) dragStore.overZone = null;
    }

    /** Drop = move the card to the column's coarse state. */
    async function columnDrop(id: ColumnId, e: DragEvent): Promise<void> {
        e.preventDefault();
        const dragged = dragStore.draggingTask;
        if (!dragged || dragStore.overZone !== `kanban:${id}`) return;
        dragStore.clear();

        if (id === 'ready') {
            if (dragged.date !== null || dragged.completed) {
                await taskStore.update(dragged.id, { date: null, completed: false });
            }
        } else if (id === 'scheduled') {
            if (dragged.date !== scheduledDropDate || dragged.completed) {
                await taskStore.update(dragged.id, {
                    date: scheduledDropDate,
                    completed: false,
                });
            }
        } else if (!dragged.completed) {
            await taskStore.update(dragged.id, { completed: true });
        }
    }

    function isOver(id: ColumnId): boolean {
        return dragStore.draggingTask !== null && dragStore.overZone === `kanban:${id}`;
    }

    function cardDragStart(task: Task, e: DragEvent): void {
        dragStore.start(task);
        // Firefox requires data for the drag to start.
        e.dataTransfer?.setData('text/plain', task.id);
    }

    // --- scheduled cards: inline date edit ---

    function setDate(task: Task, e: Event): void {
        const value = (e.currentTarget as HTMLInputElement).value;
        if (value && value !== task.date) void taskStore.update(task.id, { date: value });
    }

    // --- dependency indicators (lock) ---

    /** The blocking predecessor, when it exists and is incomplete. */
    function blockerOf(task: Task): Task | null {
        if (task.dependsOn === null) return null;
        const blocker = taskStore.tasks.find(t => t.id === task.dependsOn);
        return blocker && !blocker.completed ? blocker : null;
    }

    let blockedPickerFor = $state<string | null>(null);

    function toggleBlockedPicker(task: Task): void {
        blockedPickerFor = blockedPickerFor === task.id ? null : task.id;
    }

    /** Candidates: other top-level project tasks, never the task itself. */
    function blockerCandidates(task: Task): Task[] {
        return topLevel.filter(t => t.id !== task.id);
    }

    function setBlocker(task: Task, blockerId: string): void {
        void taskStore.update(task.id, { dependsOn: blockerId === '' ? null : blockerId });
        blockedPickerFor = null;
    }

    // --- auto-distribution (preview, then confirm) ---

    let preview = $state<DistributionAssignment[] | null>(null);
    let applying = $state(false);

    let distributionPlan = $derived(
        planProjectDistribution(tasks, {
            startDate: project.startDate,
            dueDate: project.dueDate,
            today,
        }),
    );

    function startPreview(): void {
        preview = [...distributionPlan];
    }

    function cancelPreview(): void {
        preview = null;
    }

    async function applyPlan(plan: DistributionAssignment[]): Promise<void> {
        applying = true;
        try {
            for (const assignment of plan) {
                await taskStore.update(assignment.taskId, { date: assignment.date });
            }
        } finally {
            applying = false;
            preview = null;
        }
    }

    async function confirmAutoDistribute(): Promise<void> {
        const plan = preview ?? distributionPlan;
        if (plan.length === 0) return;
        await applyPlan(plan);
    }

    /** Activate: flips isActive and distributes the backlog in one step
     *  (the roadmap's "Activate runs the auto-distribution algorithm"). */
    async function activateAndDistribute(): Promise<void> {
        const plan = distributionPlan;
        const when = plan.length > 0 ? ` and schedule ${plan.length} task${plan.length !== 1 ? 's' : ''}` : '';
        const confirmed = await uiStore.confirm(
            `Activate "${project.name}"${when}?`,
            'Activate',
        );
        if (!confirmed) return;
        await projectStore.update(project.id, { isActive: true });
        if (plan.length > 0) await applyPlan(plan);
    }

    function taskById(id: string): Task | undefined {
        return tasks.find(t => t.id === id);
    }
</script>

<div class="kanban">
    <div class="kanban-toolbar">
        <span class="kanban-hint">
            {scheduledDropDate === today
                ? 'Drops into Scheduled land on today'
                : `Drops into Scheduled land on ${scheduledDropDate}`}
        </span>
        <div class="kanban-actions">
            {#if preview !== null}
                <button class="btn btn-primary" onclick={confirmAutoDistribute} disabled={applying || preview.length === 0}>
                    {applying ? 'Applying...' : `Schedule ${preview.length}`}
                </button>
                <button class="btn btn-secondary" onclick={cancelPreview} disabled={applying}>
                    Cancel
                </button>
            {:else}
                <button
                    class="btn btn-secondary"
                    onclick={startPreview}
                    disabled={distributionPlan.length === 0}
                    aria-label="Preview auto-distribution of unscheduled tasks"
                >
                    Auto-distribute
                </button>
                {#if !project.isActive}
                    <button class="btn btn-primary" onclick={activateAndDistribute} disabled={applying}>
                        Activate
                    </button>
                {/if}
            {/if}
        </div>
    </div>

    {#if preview !== null}
        <div class="distribution-preview" aria-label="Distribution preview">
            {#if preview.length === 0}
                <p class="empty-small">
                    Nothing to schedule -- no unscheduled tasks, or the due date has passed.
                </p>
            {:else}
                <ul class="preview-list">
                    {#each preview as assignment (assignment.taskId)}
                        {#if taskById(assignment.taskId)}
                            <li class="preview-row">
                                <span class="preview-text">{taskById(assignment.taskId)?.text}</span>
                                <span class="badge">{assignment.date}</span>
                            </li>
                        {/if}
                    {/each}
                </ul>
            {/if}
        </div>
    {/if}

    <div class="kanban-columns">
        {#each columns as column (column.id)}
            <section
                class="kanban-column"
                class:drop-target={isOver(column.id)}
                aria-label="{column.title} column"
                ondragover={(e: DragEvent) => columnDragOver(column.id, e)}
                ondragleave={(e: DragEvent) => columnDragLeave(column.id, e)}
                ondrop={(e: DragEvent) => void columnDrop(column.id, e)}
            >
                <h4 class="kanban-column-heading">
                    {column.title}
                    <span class="kanban-count">{columnTasks(column.id).length}</span>
                </h4>
                <ul class="kanban-cards" role="list">
                    {#each columnTasks(column.id) as task (task.id)}
                        <li>
                            <div
                                class="kanban-card"
                                class:done={column.id === 'done'}
                                class:dragging={dragStore.isDragging(task.id)}
                                draggable="true"
                                role="listitem"
                                aria-label="{task.text}{task.date ? `, scheduled ${task.date}` : ''}{task.completed ? ', done' : ''}"
                                ondragstart={(e: DragEvent) => cardDragStart(task, e)}
                            >
                                <span class="card-text">{task.text}</span>
                                {#if column.id === 'scheduled' && task.date !== null}
                                    <input
                                        class="card-date"
                                        type="date"
                                        value={task.date}
                                        onchange={(e: Event) => setDate(task, e)}
                                        aria-label="Date for {task.text}"
                                    />
                                {/if}
                                {#if column.id !== 'done'}
                                    <button
                                        class="icon-btn small lock-btn"
                                        class:blocked={blockerOf(task) !== null}
                                        onclick={() => toggleBlockedPicker(task)}
                                        title={blockerOf(task) ? `Blocked by ${blockerOf(task)?.text}` : 'Set blocked-by'}
                                        aria-label="Set blocked-by for {task.text}"
                                    >
                                        <Icon src={LuLock} />
                                    </button>
                                {/if}
                            </div>
                            {#if blockedPickerFor === task.id}
                                <div class="blocked-picker">
                                    <select
                                        class="select"
                                        aria-label="Blocked by"
                                        value={task.dependsOn ?? ''}
                                        onchange={(e: Event) =>
                                            setBlocker(task, (e.currentTarget as HTMLSelectElement).value)}
                                    >
                                        <option value="">(not blocked)</option>
                                        {#each blockerCandidates(task) as candidate (candidate.id)}
                                            <option value={candidate.id}>{candidate.text}</option>
                                        {/each}
                                    </select>
                                    <button
                                        class="icon-btn small"
                                        onclick={() => (blockedPickerFor = null)}
                                        aria-label="Close blocked-by picker"
                                    >
                                        <Icon src={LuX} />
                                    </button>
                                    {#if blockerOf(task)}
                                        <span class="blocked-by-hint">
                                            blocked by {blockerOf(task)?.text}
                                        </span>
                                    {/if}
                                </div>
                            {/if}
                        </li>
                    {/each}
                </ul>
            </section>
        {/each}
    </div>
</div>
<style>
    .kanban {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .kanban-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
    }

    .kanban-hint {
        font-size: 12px;
        color: var(--color-text-secondary);
    }

    .kanban-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }

    .distribution-preview {
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 8px 12px;
        background: var(--color-surface-dim);
    }

    .preview-list {
        list-style: none;
        margin: 0;
        padding: 0;
        max-height: 180px;
        overflow-y: auto;
    }

    .preview-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 4px 0;
        border-bottom: 1px solid var(--color-border);
        font-size: 13px;
    }

    .preview-row:last-child {
        border-bottom: none;
    }

    .preview-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .badge {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 10px;
        background: var(--color-surface-hover);
        color: var(--color-text-secondary);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .kanban-columns {
        display: flex;
        gap: 12px;
        align-items: flex-start;
    }

    .kanban-column {
        flex: 1;
        min-width: 0;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 8px;
        background: var(--color-surface-dim);
        transition: border-color 0.15s ease, background 0.15s ease;
    }

    .kanban-column.drop-target {
        border-color: var(--color-accent);
        background: color-mix(in oklab, var(--color-accent) 7%, transparent);
    }

    .kanban-column-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 0 0 8px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--color-text-secondary);
    }

    .kanban-count {
        font-variant-numeric: tabular-nums;
    }

    .kanban-cards {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .kanban-card {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 8px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-surface);
        cursor: grab;
        font-size: 13px;
    }

    .kanban-card:active {
        cursor: grabbing;
    }

    .kanban-card.dragging {
        opacity: 0.5;
    }

    .kanban-card.done .card-text {
        text-decoration: line-through;
        color: var(--color-text-secondary);
    }

    .kanban-card.done {
        cursor: default;
    }

    .card-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .card-date {
        padding: 2px 4px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background: var(--color-surface);
        color: var(--color-text);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
    }

    .lock-btn :global(svg) {
        width: 13px;
        height: 13px;
    }

    .lock-btn.blocked {
        color: var(--color-danger);
    }

    .blocked-picker {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 4px;
    }

    .blocked-picker .select {
        flex: 1;
        min-width: 0;
        padding: 4px 8px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-surface);
        color: var(--color-text);
        font-size: 12px;
    }

    .blocked-by-hint {
        font-size: 11px;
        color: var(--color-text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .empty-small {
        color: var(--color-text-secondary);
        font-size: 13px;
        margin: 0;
    }

    /* Mobile (v0.6.0 tier): stack the columns under the modal's
       bottom-sheet width. */
    @media (max-width: 767px) {
        .kanban-columns {
            flex-direction: column;
        }
    }
</style>
