<script lang="ts">
    import Modal from '#lib/components/Modal.svelte';
    import TaskRow from '#lib/components/TaskRow.svelte';
    import HillProgress from '#lib/components/HillProgress.svelte';
    import InlineAddTask from '#lib/components/InlineAddTask.svelte';
    import {
        notificationStore,
        projectStore,
        recurringTaskStore,
        somedayListStore,
        somedayTabStore,
        taskStore,
        uiStore,
    } from '#lib/stores/index.ts';
    import { gatherProjectHome } from '#lib/projectHome.ts';
    import { container } from '#lib/container.ts';
    import { Icon } from 'svelte-icons-pack';
    import { LuPlus, LuPencil, LuTrash2, LuArrowLeft, LuCheck, LuListPlus } from 'svelte-icons-pack/lu';
    import { onMount } from 'svelte';
    import { i18nStore } from '#lib/i18n/i18nStore.svelte.ts';

    let { onclose = () => {} }: { onclose?: () => void } = $props();

    onMount(() => {
        projectStore.fetchAll();
        // Routines + their streaks ride the gathered view (USE-17).
        void recurringTaskStore.fetchAll().then(() => {
            void recurringTaskStore.fetchStats(recurringTaskStore.habits.map(h => h.id));
        });
        // A cross-link can open the modal straight onto one project's
        // home (chips hop here).
        const target = uiStore.modalParams?.projectId;
        if (target) selectedProjectId = target;
    });

    let projects = $derived(projectStore.projects);

    let showNewForm = $state(false);
    let newProjectName = $state('');
    let newProjectDesc = $state('');
    let creating = $state(false);

    let editingProjectId = $state<string | null>(null);
    let editName = $state('');
    let editDesc = $state('');

    let selectedProjectId = $state<string | null>(null);
    let selectedProject = $derived(projectStore.projects.find(p => p.id === selectedProjectId));

    function getTaskCount(tag: string): number {
        return taskStore.tasks.filter(t => t.tags.includes(tag)).length;
    }

    // -- the gathered home (USE-17, ADR-011) --------------------------------
    // The tag is the join key: everything here already lives on days or
    // in someday lists. The home reads; it never moves or contains.

    let home = $derived(
        selectedProject
            ? gatherProjectHome(
                  selectedProject,
                  taskStore.tasks,
                  somedayListStore.items,
                  recurringTaskStore.habits,
                  recurringTaskStore.stats,
              )
            : null,
    );

    let projectTab = $derived(
        selectedProject
            ? somedayTabStore.items.find(t => t.projectTag === selectedProject.tag) ?? null
            : null,
    );
    // New members park in the project tab's first list; without one they
    // land Unlisted (the default tab's catch-all) and still gather here.
    let projectListId = $derived(
        projectTab
            ? (somedayListStore.sortedLists.find(l => l.tabId === projectTab.id)?.id ?? null)
            : null,
    );

    // -- metadata: dates, hill, done ---------------------------------------

    let startValue = $state('');
    let dueValue = $state('');
    $effect(() => {
        startValue = selectedProject?.startDate ?? '';
        dueValue = selectedProject?.dueDate ?? '';
    });

    function patchDate(field: 'startDate' | 'dueDate', value: string): void {
        if (!selectedProject) return;
        void projectStore.update(selectedProject.id, { [field]: value === '' ? null : value });
    }

    async function markComplete(): Promise<void> {
        if (!selectedProject) return;
        const updated = await projectStore.update(selectedProject.id, {
            completedAt: container.dateProvider.timestamp(),
        });
        if (!updated) {
            notificationStore.push(i18nStore.t('projects.markCompleteFailed'), { kind: 'error' });
        }
    }

    async function reopen(): Promise<void> {
        if (!selectedProject) return;
        await projectStore.update(selectedProject.id, { completedAt: null });
    }

    function handleNewTask(): void {
        // The grammar input (InlineAddTask) carries the tag; nothing else
        // to do -- created members gather automatically.
    }

    // -- add list from the project -----------------------------------------

    let showAddListForm = $state(false);
    let newListName = $state('');

    async function addProjectList(): Promise<void> {
        const name = newListName.trim();
        if (!name || !selectedProject) return;
        let tab = projectTab;
        if (!tab) {
            // The auto-tab is missing (an older project, or the tab was
            // deleted): recreate it -- the tag is still the link.
            tab = await somedayTabStore.create({
                name: selectedProject.name,
                position: somedayTabStore.items.length,
                projectTag: selectedProject.tag,
            });
        }
        if (!tab) {
            notificationStore.push(i18nStore.t('someday.createTabFailed'), { kind: 'error' });
            return;
        }
        const created = await somedayListStore.create({
            tabId: tab.id,
            name,
            position: somedayListStore.items.length,
        });
        if (!created) {
            notificationStore.push(i18nStore.t('someday.createListFailed'), { kind: 'error' });
            return;
        }
        newListName = '';
        showAddListForm = false;
    }

    function cancelAddList() {
        newListName = '';
        showAddListForm = false;
    }

    function handleAddListKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            void addProjectList();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelAddList();
        }
    }

    // -- list view CRUD -----------------------------------------------------

    function handleNewKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' && newProjectName.trim()) {
            createProject();
        } else if (e.key === 'Escape') {
            cancelNew();
        }
    }

    async function createProject() {
        if (!newProjectName.trim()) return;
        creating = true;
        const result = await projectStore.create({
            name: newProjectName.trim(),
            description: newProjectDesc.trim() || null,
        });
        creating = false;
        if (result) {
            // Auto-tab (USE-16, ADR-011): the project's Someday tab is
            // born with it, carrying the project's tag -- the tab's lists
            // inherit it. The tag is the join key; nothing else links them.
            void somedayTabStore.create({
                name: result.name,
                position: somedayTabStore.items.length,
                projectTag: result.tag,
            });
            newProjectName = '';
            newProjectDesc = '';
            showNewForm = false;
        } else {
            // A failed create must be heard, not just silently kept (the
            // form stays open either way).
            notificationStore.push(i18nStore.t('projects.createFailed'), { kind: 'error' });
        }
    }

    function cancelNew() {
        showNewForm = false;
        newProjectName = '';
        newProjectDesc = '';
    }

    function startEdit(projectId: string, name: string, description: string | null) {
        editingProjectId = projectId;
        editName = name;
        editDesc = description ?? '';
    }

    function cancelEdit() {
        editingProjectId = null;
        editName = '';
        editDesc = '';
    }

    function handleEditKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter' && editName.trim()) {
            saveEdit();
        } else if (e.key === 'Escape') {
            cancelEdit();
        }
    }

    async function saveEdit() {
        if (!editingProjectId || !editName.trim()) return;
        await projectStore.update(editingProjectId, {
            name: editName.trim(),
            description: editDesc.trim() || null,
        });
        editingProjectId = null;
    }

    async function deleteProject(id: string) {
        const project = projectStore.projects.find(p => p.id === id);
        if (!project) return;
        // A project is an umbrella, never a container (ADR-011): deleting
        // it leaves the work in place -- the tasks keep the project tag
        // -- so the confirm says so. Nothing destructive beyond the
        // umbrella itself.
        if (!(await uiStore.confirm(i18nStore.t('projects.deleteConfirm', { name: project.name })))) return;
        await projectStore.remove(id);
        if (selectedProjectId === id) {
            selectedProjectId = null;
        }
    }

    function selectProject(id: string) {
        selectedProjectId = id;
    }

    function backToList() {
        selectedProjectId = null;
    }
</script>

<Modal title={i18nStore.t('modal.projects')} onclose={onclose}>
    {#if selectedProject && home}
        <div class="detail-view">
            <button class="back-btn" onclick={backToList}>
                <Icon src={LuArrowLeft} />
                <span>{i18nStore.t('projects.backToList')}</span>
            </button>

            <div class="detail-header">
                <h3 class="detail-name">{selectedProject.name}</h3>
                <div class="detail-actions">
                    {#if editingProjectId !== selectedProject.id}
                        <button class="icon-btn" onclick={() => startEdit(selectedProject!.id, selectedProject!.name, selectedProject!.description)} aria-label={i18nStore.t('projects.editProject')}>
                            <Icon src={LuPencil} />
                        </button>
                    {/if}
                    <button class="icon-btn danger" onclick={() => deleteProject(selectedProject!.id)} aria-label={i18nStore.t('projects.deleteProject')}>
                        <Icon src={LuTrash2} />
                    </button>
                </div>
            </div>

            {#if editingProjectId === selectedProject.id}
                <div class="inline-form">
                    <input type="text" bind:value={editName} placeholder={i18nStore.t('projects.namePlaceholder')} aria-label={i18nStore.t('projects.nameAria')} onkeydown={handleEditKeydown} />
                    <input type="text" bind:value={editDesc} placeholder={i18nStore.t('projects.descPlaceholder')} aria-label={i18nStore.t('projects.descAria')} onkeydown={handleEditKeydown} />
                    <div class="form-actions">
                        <button class="btn btn-primary" onclick={saveEdit}>{i18nStore.t('projects.save')}</button>
                        <button class="btn btn-secondary" onclick={cancelEdit}>{i18nStore.t('common.cancel')}</button>
                    </div>
                </div>
            {:else}
                {#if selectedProject.description}
                    <p class="detail-desc">{selectedProject.description}</p>
                {/if}

                <div class="meta-row">
                    <label class="meta-date">
                        <span>{i18nStore.t('projects.startLabel')}</span>
                        <input
                            type="date"
                            value={startValue}
                            onchange={(e) => patchDate('startDate', (e.currentTarget as HTMLInputElement).value)}
                            aria-label={i18nStore.t('projects.startAria')}
                        />
                    </label>
                    <label class="meta-date">
                        <span>{i18nStore.t('projects.dueLabel')}</span>
                        <input
                            type="date"
                            value={dueValue}
                            onchange={(e) => patchDate('dueDate', (e.currentTarget as HTMLInputElement).value)}
                            aria-label={i18nStore.t('projects.dueAria')}
                        />
                    </label>
                    <HillProgress projectId={selectedProject.id} position={selectedProject.hillPosition} />
                    <div class="complete-box">
                        {#if selectedProject.completedAt}
                            <span class="completed-at">{i18nStore.t('projects.completedOn', { date: selectedProject.completedAt.slice(0, 10) })}</span>
                            <button class="btn btn-secondary" onclick={reopen}>{i18nStore.t('projects.reopen')}</button>
                        {:else}
                            <button class="btn btn-primary" onclick={markComplete}>{i18nStore.t('projects.markComplete')}</button>
                        {/if}
                    </div>
                </div>

                <!-- Create from the project: the grammar input (task, or a
                     habit when a routine phrase is typed) auto-applies the
                     project tag; + add list parks a new shelf under the
                     project's tab. -->
                <InlineAddTask
                    date=""
                    somedayListId={projectListId}
                    autoTag={selectedProject.tag}
                    oncreated={handleNewTask}
                />
                {#if showAddListForm}
                    <div class="add-list-form">
                        <input
                            type="text"
                            bind:value={newListName}
                            placeholder={i18nStore.t('someday.listNamePlaceholder')}
                            aria-label={i18nStore.t('projects.newProjectListName')}
                            onkeydown={handleAddListKeydown}
                        />
                        <button class="icon-btn" onclick={addProjectList} aria-label={i18nStore.t('someday.createList')}>
                            <Icon src={LuCheck} size={14} />
                        </button>
                    </div>
                {:else}
                    <button class="add-list-btn" onclick={() => (showAddListForm = true)}>
                        <Icon src={LuListPlus} size={13} />
                        {i18nStore.t('projects.addList')}
                    </button>
                {/if}

                {#if home.backlog.length > 0}
                    <section class="home-section" aria-labelledby="project-backlog-heading">
                        <h4 id="project-backlog-heading" class="modal-section-heading">{i18nStore.t('projects.backlogHeading')}</h4>
                        {#each home.backlog as group (group.listId ?? 'unlisted')}
                            <div class="home-group">
                                <div class="home-group-title">
                                    {group.listId !== null ? group.listName : i18nStore.t('someday.unlisted')}
                                </div>
                                <div class="home-tasks">
                                    {#each group.tasks as task (task.id)}
                                        <TaskRow {task} dragEnabled={false} />
                                    {/each}
                                </div>
                            </div>
                        {/each}
                    </section>
                {/if}

                {#if home.scheduled.length > 0}
                    <section class="home-section" aria-labelledby="project-scheduled-heading">
                        <h4 id="project-scheduled-heading" class="modal-section-heading">{i18nStore.t('projects.scheduledHeading')}</h4>
                        {#each home.scheduled as day (day.date)}
                            <div class="home-group">
                                <div class="home-group-title">{container.dateProvider.formatDate(day.date, 'full')}</div>
                                <div class="home-tasks">
                                    {#each day.tasks as task (task.id)}
                                        <TaskRow {task} dragEnabled={false} />
                                    {/each}
                                </div>
                            </div>
                        {/each}
                    </section>
                {/if}

                {#if home.routines.length > 0}
                    <section class="home-section" aria-labelledby="project-routines-heading">
                        <h4 id="project-routines-heading" class="modal-section-heading">{i18nStore.t('projects.routinesHeading')}</h4>
                        {#each home.routines as { habit, streak } (habit.id)}
                            <div class="routine-row">
                                <span class="routine-text">{habit.text}</span>
                                {#if streak > 0}
                                    <span class="streak-badge">{i18nStore.t('projects.streakDays', { count: streak })}</span>
                                {/if}
                            </div>
                        {/each}
                    </section>
                {/if}

                <section class="home-section" aria-labelledby="project-done-heading">
                    <h4 id="project-done-heading" class="modal-section-heading">{i18nStore.t('projects.doneHeading', { count: home.doneCount })}</h4>
                    {#if home.doneRecent.length > 0}
                        <div class="home-tasks">
                            {#each home.doneRecent as task (task.id)}
                                <TaskRow {task} dragEnabled={false} />
                            {/each}
                        </div>
                    {:else}
                        <p class="home-empty">{i18nStore.t('projects.doneEmpty')}</p>
                    {/if}
                </section>
            {/if}
        </div>
    {:else}
        <div class="projects">
            <div class="list-header">
                <h3>{i18nStore.t('modal.projects')}</h3>
                <button class="icon-btn" onclick={() => (showNewForm = true)} aria-label={i18nStore.t('projects.new')}>
                    <Icon src={LuPlus} />
                </button>
            </div>

            {#if showNewForm}
                <div class="inline-form">
                    <input type="text" bind:value={newProjectName} placeholder={i18nStore.t('projects.namePlaceholder')} aria-label={i18nStore.t('projects.nameAria')} onkeydown={handleNewKeydown} />
                    <input type="text" bind:value={newProjectDesc} placeholder={i18nStore.t('projects.descPlaceholder')} aria-label={i18nStore.t('projects.descAria')} onkeydown={handleNewKeydown} />
                    <div class="form-actions">
                        <button class="btn btn-primary" onclick={createProject} disabled={!newProjectName.trim() || creating}>
                            {creating ? i18nStore.t('projects.creating') : i18nStore.t('projects.create')}
                        </button>
                        <button class="btn btn-secondary" onclick={cancelNew}>{i18nStore.t('common.cancel')}</button>
                    </div>
                </div>
            {/if}

            {#each projects as project (project.id)}
                {#if editingProjectId === project.id}
                    <div class="project-card editing">
                        <input type="text" bind:value={editName} placeholder={i18nStore.t('projects.namePlaceholder')} aria-label={i18nStore.t('projects.nameAria')} onkeydown={handleEditKeydown} />
                        <input type="text" bind:value={editDesc} placeholder={i18nStore.t('projects.descPlaceholder')} aria-label={i18nStore.t('projects.descAria')} onkeydown={handleEditKeydown} />
                        <div class="form-actions">
                            <button class="btn btn-primary" onclick={saveEdit}>{i18nStore.t('projects.save')}</button>
                            <button class="btn btn-secondary" onclick={cancelEdit}>{i18nStore.t('common.cancel')}</button>
                        </div>
                    </div>
                {:else}
                    <!-- The card is a plain container; the OPEN affordance is a
                         real button wrapping name/description/meta, so the edit
                         and delete actions nest as SIBLINGS, not inside another
                         interactive control (axe nested-interactive, USE-9).
                         Enter/Space come from the button itself. -->
                    <div class="project-card">
                        <div class="card-top">
                            <button
                                class="card-open"
                                onclick={() => selectProject(project.id)}
                                aria-label={i18nStore.t('projects.open', { name: project.name })}
                            >
                                <div class="project-name">{project.name}</div>
                                {#if project.description}
                                    <div class="project-desc">{project.description}</div>
                                {/if}
                                <div class="project-meta">
                                    {#if project.startDate}
                                        <span>{i18nStore.t('projects.start', { date: project.startDate })}</span>
                                    {/if}
                                    {#if project.dueDate}
                                        <span>{i18nStore.t('projects.due', { date: project.dueDate })}</span>
                                    {/if}
                                    <span class="task-count">{i18nStore.t('projects.taskCount', { count: getTaskCount(project.tag) })}</span>
                                </div>
                            </button>
                            <div class="card-actions">
                                <button class="icon-btn small" onclick={() => startEdit(project.id, project.name, project.description)} aria-label={i18nStore.t('projects.editProject')}>
                                    <Icon src={LuPencil} />
                                </button>
                                <button class="icon-btn small danger" onclick={() => deleteProject(project.id)} aria-label={i18nStore.t('projects.deleteProject')}>
                                    <Icon src={LuTrash2} />
                                </button>
                            </div>
                        </div>
                    </div>
                {/if}
            {/each}

            {#if projectStore.projects.length === 0 && !showNewForm}
                <p class="empty">{i18nStore.t('projects.empty')}</p>
            {/if}
        </div>
    {/if}
</Modal>

<style>
    .projects, .detail-view {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .project-card {
        padding: 12px;
        background: var(--color-surface-dim);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: border-color 0.15s ease;
    }

    .project-card:hover {
        border-color: var(--color-accent);
    }

    /* The open affordance: a real button covering name/desc/meta, so the
       card body stays a plain (non-interactive) container. */
    .card-open {
        flex: 1;
        min-width: 0;
        background: none;
        border: none;
        padding: 0;
        text-align: start;
        cursor: pointer;
        color: var(--color-text);
        font: inherit;
    }

    .card-open:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
        border-radius: 4px;
    }

    .project-card.editing {
        cursor: default;
    }

    .project-card.editing:hover {
        border-color: var(--color-border);
    }

    .project-name {
        font-weight: 600;
        font-size: 14px;
    }

    .project-desc {
        font-size: 13px;
        color: var(--color-text-secondary);
        margin-top: 4px;
    }

    .project-meta {
        font-size: 12px;
        color: var(--color-text-secondary);
        margin-top: 6px;
        display: flex;
        gap: 12px;
    }

    .task-count {
        color: var(--color-text-secondary);
    }

    .back-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        background: none;
        border: none;
        color: var(--color-text-secondary);
        font-size: 13px;
        cursor: pointer;
        padding: 4px 0;
    }

    .back-btn:hover {
        color: var(--color-text);
    }

    .detail-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 8px;
    }

    .detail-actions {
        display: flex;
        gap: 4px;
    }

    .detail-name {
        font-size: 18px;
        font-weight: 700;
        margin: 0;
        color: var(--color-text);
    }

    .detail-desc {
        font-size: 14px;
        color: var(--color-text-secondary);
        margin: 0;
    }

    /* Metadata row: editable dates, the hill, and the explicit
       Mark complete (nothing stamps itself -- ADR-011). */
    .meta-row {
        display: flex;
        align-items: flex-end;
        gap: 16px;
        flex-wrap: wrap;
    }

    .meta-date {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 12px;
        color: var(--color-text-secondary);
    }

    .meta-date input {
        font-size: 13px;
        padding: 2px 4px;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background: var(--color-surface);
        color: var(--color-text);
    }

    .complete-box {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-inline-start: auto;
    }

    .completed-at {
        font-size: 12px;
        color: var(--color-text-secondary);
    }

    .add-list-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: none;
        border: none;
        font-size: 12px;
        color: var(--color-text-secondary);
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        transition: color 0.15s, background-color 0.15s;
    }

    .add-list-btn:hover {
        color: var(--color-text);
        background: var(--color-surface-hover);
    }

    .add-list-form {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .add-list-form input {
        font-size: 12px;
        padding: 2px 6px;
        border: 1px solid var(--color-accent);
        border-radius: 4px;
        outline: none;
        background: var(--color-surface);
        color: var(--color-text);
        width: 160px;
    }

    .home-section {
        margin-top: 8px;
    }

    .home-group {
        margin-bottom: 10px;
    }

    .home-group-title {
        font-size: 12px;
        font-weight: 600;
        color: var(--color-text-secondary);
        margin-bottom: 4px;
    }

    .home-tasks {
        display: flex;
        flex-direction: column;
    }

    .routine-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 2px;
        font-size: 14px;
    }

    .routine-text {
        flex: 1;
        min-width: 0;
    }

    .streak-badge {
        font-size: 12px;
        color: var(--color-accent);
        background: color-mix(in oklab, var(--color-accent) 12%, transparent);
        border-radius: 4px;
        padding: 1px 6px;
        flex-shrink: 0;
    }

    .home-empty {
        font-size: 13px;
        color: var(--color-text-secondary);
        margin: 4px 0;
    }

    .icon-btn :global(svg) {
        width: 16px;
        height: 16px;
    }

    .icon-btn.small :global(svg) {
        width: 14px;
        height: 14px;
    }

    .back-btn :global(svg) {
        width: 16px;
        height: 16px;
    }
</style>
