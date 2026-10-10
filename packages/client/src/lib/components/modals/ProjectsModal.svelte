<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import KanbanBoard from '$lib/components/KanbanBoard.svelte';
    import { notificationStore, projectStore, taskStore, uiStore } from '$lib/stores';
    import { Icon } from 'svelte-icons-pack';
    import { LuPlus, LuPencil, LuTrash2, LuArrowLeft } from 'svelte-icons-pack/lu';
    import { onMount } from 'svelte';
    import { i18nStore } from '$lib/i18n/i18nStore.svelte';

    let { onclose = () => {} }: { onclose?: () => void } = $props();

    onMount(() => {
        projectStore.fetchAll();
    });

    let activeProjects = $derived(projectStore.projects.filter(p => p.isActive));
    let inactiveProjects = $derived(projectStore.projects.filter(p => !p.isActive));

    let showNewForm = $state(false);
    let newProjectName = $state('');
    let newProjectDesc = $state('');
    let creating = $state(false);

    let editingProjectId = $state<string | null>(null);
    let editName = $state('');
    let editDesc = $state('');

    let selectedProjectId = $state<string | null>(null);
    let selectedProject = $derived(projectStore.projects.find(p => p.id === selectedProjectId));
    let projectTasks = $derived(
        selectedProjectId && selectedProject
            ? taskStore.tasks.filter(t => t.tags.includes(selectedProject!.tag))
            : [],
    );

    function getTaskCount(tag: string): number {
        return taskStore.tasks.filter(t => t.tags.includes(tag)).length;
    }

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
        // Deletion is irreversible, so it confirms like the Someday-group
        // delete -- but the message does not count tasks: deleting a
        // project leaves its tasks in place (they keep the project tag),
        // so there is nothing destructive beyond the project itself.
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
    {#if selectedProject}
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
                <div class="detail-meta">
                    {#if selectedProject.startDate}
                        <span>{i18nStore.t('projects.start', { date: selectedProject.startDate })}</span>
                    {/if}
                    {#if selectedProject.dueDate}
                        <span>{i18nStore.t('projects.due', { date: selectedProject.dueDate })}</span>
                    {/if}
                    <span>{i18nStore.t('projects.status', { status: selectedProject.isActive ? i18nStore.t('projects.active') : i18nStore.t('projects.inactive') })}</span>
                </div>
            {/if}

            <section class="detail-kanban" aria-label={i18nStore.t('projects.boardAria')}>
                <h4 class="modal-section-heading">{i18nStore.t('projects.board')}</h4>
                <KanbanBoard project={selectedProject} tasks={projectTasks} />
            </section>
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

            {#if activeProjects.length > 0}
                <section class="section" aria-label={i18nStore.t('projects.activeSectionAria')}>
                    <h4 id="projects-active-heading" class="modal-section-heading">{i18nStore.t('projects.activeHeading')}</h4>
                    {#each activeProjects as project (project.id)}
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
                                        aria-label={i18nStore.t('projects.openActive', { name: project.name })}
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
                </section>
            {/if}

            {#if inactiveProjects.length > 0}
                <section class="section" aria-label={i18nStore.t('projects.inactiveSectionAria')}>
                    <h4 id="projects-inactive-heading" class="modal-section-heading">{i18nStore.t('projects.inactiveHeading')}</h4>
                    {#each inactiveProjects as project (project.id)}
                        <div class="project-card inactive">
                            <div class="card-top">
                                <button
                                    class="card-open"
                                    onclick={() => selectProject(project.id)}
                                    aria-label={i18nStore.t('projects.openInactive', { name: project.name })}
                                >
                                    <div class="project-name">{project.name}</div>
                                    {#if project.description}
                                        <div class="project-desc">{project.description}</div>
                                    {/if}
                                    <div class="project-meta">
                                        <span class="task-count">{i18nStore.t('projects.taskCount', { count: getTaskCount(project.tag) })}</span>
                                    </div>
                                </button>
                                <div class="card-actions">
                                    <button class="icon-btn small danger" onclick={() => deleteProject(project.id)} aria-label={i18nStore.t('projects.deleteProject')}>
                                        <Icon src={LuTrash2} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    {/each}
                </section>
            {/if}

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

    .project-card.inactive {
        opacity: 0.6;
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

    .detail-meta {
        font-size: 13px;
        color: var(--color-text-secondary);
        display: flex;
        gap: 16px;
    }

    .detail-kanban {
        margin-top: 4px;
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