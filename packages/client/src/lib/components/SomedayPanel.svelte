<script lang="ts">
    import {
        notificationStore,
        preferencesStore,
        somedayListStore,
        somedayTabStore,
        dragStore,
        taskStore,
        uiStore,
        type TaskSection,
    } from '#lib/stores/index.ts';
    import { applyFilters } from '#lib/filters.ts';
    import { byPositionThenCreated, snapInsertBeforeId } from '#lib/dragReorder.ts';
    import { commitZoneDrop, zoneDragLeave, zoneDragOver } from '#lib/nndZone.ts';
    import { createNewlyCreatedTracker } from '#lib/newlyCreated.svelte.ts';
    import TaskRow from './TaskRow.svelte';
    import InlineAddTask from './InlineAddTask.svelte';
    import SectionHeader from './SectionHeader.svelte';
    import { Icon } from 'svelte-icons-pack';
    import { LuChevronRight, LuPencil, LuTrash2, LuCheck } from 'svelte-icons-pack/lu';
    import {
        DEFAULT_SOMEDAY_TAB_ID,
        type SomedayList,
        type SomedayTab,
        type Task,
        type UpdateTaskInput,
    } from '@erledigen/shared';
    import { tooltip } from '#lib/tooltip.ts';
    import { openProjectHomeByTag } from '#lib/projectLink.ts';
    import { i18nStore } from '#lib/i18n/i18nStore.svelte.ts';

    // -- tabs --------------------------------------------------------------
    // Tabs hold lists (USE-16); the default tab (fixed id, undeletable) is
    // the home of unlisted parked tasks, so nothing ever goes invisible.
    // The active tab is session state -- it resets to the default tab.

    let activeTabId = $state<string | null>(null);
    let tabs = $derived(somedayTabStore.sortedTabs);
    let activeTab = $derived(
        tabs.find(t => t.id === activeTabId) ?? tabs[0] ?? null,
    );

    let showAddTabForm = $state(false);
    let newTabName = $state('');
    let newTabInput: HTMLInputElement | undefined = $state();
    let editingTabId = $state<string | null>(null);
    let editTabInput: HTMLInputElement | undefined = $state();

    // With only the default tab, the tab strip shows no label: the area
    // carries no title (the story's "no title shown").
    let showTabLabels = $derived(tabs.length > 1 || tabs[0]?.id !== DEFAULT_SOMEDAY_TAB_ID);

    function switchTab(id: string): void {
        activeTabId = id;
    }

    // -- lists ---------------------------------------------------------------

    let lists = $derived(somedayListStore.sortedLists);
    let activeTabLists = $derived(
        activeTab ? lists.filter(l => l.tabId === activeTab.id) : [],
    );

    let showAddListForm = $state(false);
    let newListName = $state('');
    let newListInput: HTMLInputElement | undefined = $state();
    let editingListId = $state<string | null>(null);
    let editListName = $state('');
    let editListInput: HTMLInputElement | undefined = $state();

    let isCollapsed = $derived(preferencesStore.someDayPanelWidth === 0);

    // Drag-to-resize. Panel sits on the right edge of the layout, so dragging
    // its left handle to the left grows the width (deltaX = startX - clientX).
    const MIN_PANEL_WIDTH = 200;
    const MAX_PANEL_WIDTH = 600;
    const COLLAPSE_THRESHOLD = 120; // release below this -> snap shut
    let isResizing = $state(false);

    function startResize(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startWidth = preferencesStore.someDayPanelWidth;
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        function onMouseMove(ev: MouseEvent) {
            const deltaX = startX - ev.clientX;
            const newWidth = Math.max(0, Math.min(MAX_PANEL_WIDTH, startWidth + deltaX));
            // Live update only the local state; persist once on release.
            preferencesStore.someDayPanelWidth = newWidth;
        }

        function onMouseUp() {
            isResizing = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            const w = preferencesStore.someDayPanelWidth;
            if (w < COLLAPSE_THRESHOLD) {
                preferencesStore.setPanelWidth(0);
            } else {
                preferencesStore.setPanelWidth(Math.max(MIN_PANEL_WIDTH, w));
            }
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    let filteredSomedayTasks = $derived(applyFilters(taskStore.somedayTasks, preferencesStore.activeFilters));

    // Dateless tasks with no list. They render in the default tab (its
    // implicit "Unlisted" section) so parked work is never invisible.
    let unlistedTasks = $derived(
        filteredSomedayTasks.filter(t => t.somedayListId === null).sort(byPositionThenCreated),
    );

    // The unlisted section renders only when the default tab (or no tab at
    // all -- a defensive case) is active: one place, no duplication.
    let showUnlisted = $derived(activeTab === null || activeTab.id === DEFAULT_SOMEDAY_TAB_ID);

    // Publish the active tab's task ids in render order (lists, then
    // unlisted) so global j/k navigation can move through Someday tasks,
    // and the list sections so J/K can jump between them. Cleared when
    // collapsed so stale ids never steer navigation.
    $effect(() => {
        if (isCollapsed || activeTab === null) {
            uiStore.setVisibleSomedayTasks([]);
            uiStore.setVisibleSomedaySections([]);
            return;
        }
        const ids: string[] = [];
        const sections: TaskSection[] = [];
        for (const list of activeTabLists) {
            const sectionIds = listTasks(list).map(t => t.id);
            ids.push(...sectionIds);
            // Empty lists are skipped: a J/K jump lands on a task, and an
            // empty section has none to focus.
            if (sectionIds.length > 0) sections.push({ key: list.id, taskIds: sectionIds });
        }
        if (showUnlisted) {
            const unlistedIds = unlistedTasks.map(t => t.id);
            if (unlistedIds.length > 0) {
                ids.push(...unlistedIds);
                sections.push({ key: 'unlisted', taskIds: unlistedIds });
            }
        }
        uiStore.setVisibleSomedayTasks(ids);
        uiStore.setVisibleSomedaySections(sections);
    });

    // Newly created rows flash for 600ms (shared helper).
    let newlyCreated = createNewlyCreatedTracker();

    $effect(() => {
        if (showAddTabForm && newTabInput) newTabInput.focus();
    });

    $effect(() => {
        if (showAddListForm && newListInput) newListInput.focus();
    });

    $effect(() => {
        if (editingTabId && editTabInput) editTabInput.focus();
    });

    $effect(() => {
        if (editingListId && editListInput) editListInput.focus();
    });

    function listTasks(list: SomedayList) {
        // Position-aware display order (drag reorders patch positions),
        // matching the day list's groupTasksByDate comparator.
        return filteredSomedayTasks.filter(t => t.somedayListId === list.id).sort(byPositionThenCreated);
    }

    // --- drop zones (native HTML5 DnD) ---------------------------------
    // Each list is a zone (dragging in sets date=null + the list id);
    // the unlisted section and the panel padding share the
    // someday-unlisted zone (list id null). List handlers stop
    // propagation so the padding fallback never double-fires.

    let listEls = $state<Record<string, HTMLDivElement | undefined>>({});

    const UNLISTED_ZONE = 'someday-unlisted';

    function zoneDrop(zoneTasks: Task[], listId: string | null, e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        const dragged = dragStore.draggingTask;
        if (!dragged) return;
        const base: UpdateTaskInput = {};
        if (dragged.date !== null) base.date = null;
        if (dragged.somedayListId !== listId) base.somedayListId = listId;
        commitZoneDrop(zoneTasks, dragged, base, (id, input) => void taskStore.update(id, input));
    }

    function indicatorBeforeId(zoneId: string, zoneTasks: Task[]): string | null {
        if (dragStore.overZone !== zoneId) return null;
        return snapInsertBeforeId(zoneTasks, dragStore.insertBeforeId);
    }

    // --- tabs CRUD --------------------------------------------------------

    async function submitNewTab() {
        const name = newTabName.trim();
        if (!name) return;
        const created = await somedayTabStore.create({ name, position: tabs.length });
        if (!created) {
            // The form stays open; say why (USE-12: errors are announced).
            notificationStore.push(i18nStore.t('someday.createTabFailed'), { kind: 'error' });
            return;
        }
        newTabName = '';
        showAddTabForm = false;
        activeTabId = created.id;
    }

    function cancelNewTab() {
        newTabName = '';
        showAddTabForm = false;
    }

    function handleNewTabKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitNewTab();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelNewTab();
        }
    }

    async function commitRenameTab(tab: SomedayTab, name: string) {
        if (!name) return;
        const updated = await somedayTabStore.update(tab.id, { name });
        if (!updated) {
            notificationStore.push(i18nStore.t('someday.renameFailed'), { kind: 'error' });
            return; // keep the editor open with the text
        }
        editingTabId = null;
    }

    function cancelRenameTab() {
        editingTabId = null;
    }

    function handleRenameTabKeydown(e: KeyboardEvent, tab: SomedayTab) {
        if (e.key === 'Enter') {
            e.preventDefault();
            void commitRenameTab(tab, (e.currentTarget as HTMLInputElement).value.trim());
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelRenameTab();
        }
    }

    async function handleDeleteTab(tab: SomedayTab) {
        const tabLists = lists.filter(l => l.tabId === tab.id);
        const taskCount = tabLists.reduce((sum, l) => sum + listTasks(l).length, 0);
        const msg =
            taskCount > 0 || tabLists.length > 0
                ? i18nStore.t('someday.deleteTabConfirm', {
                      name: tab.name,
                      lists: tabLists.length,
                      tasks: taskCount,
                  })
                : i18nStore.t('someday.deleteTabConfirmEmpty', { name: tab.name });
        if (!(await uiStore.confirm(msg))) return;

        // KNOWN ROUGH EDGE (same debt as list delete): the tasks and
        // lists go one by one, so a tab delete costs N HTTP round-trips.
        for (const list of tabLists) {
            for (const task of [...listTasks(list)]) {
                await taskStore.remove(task.id);
            }
            await somedayListStore.remove(list.id);
        }
        await somedayTabStore.remove(tab.id);
        if (activeTabId === tab.id) activeTabId = DEFAULT_SOMEDAY_TAB_ID;
    }

    // --- lists CRUD -------------------------------------------------------

    async function submitNewList() {
        const name = newListName.trim();
        if (!name || activeTab === null) return;
        const created = await somedayListStore.create({
            tabId: activeTab.id,
            name,
            position: lists.length,
        });
        if (!created) {
            notificationStore.push(i18nStore.t('someday.createListFailed'), { kind: 'error' });
            return;
        }
        newListName = '';
        showAddListForm = false;
    }

    function cancelNewList() {
        newListName = '';
        showAddListForm = false;
    }

    function handleNewListKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitNewList();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelNewList();
        }
    }

    function startRenameList(list: SomedayList) {
        editingListId = list.id;
        editListName = list.name;
    }

    function commitRenameList() {
        if (!editingListId) return;
        const name = editListName.trim();
        if (name) {
            void commitRename();
        } else {
            editingListId = null;
            editListName = '';
        }
    }

    async function commitRename() {
        // Snapshot before awaiting (the repo's async-handler rule).
        const id = editingListId;
        const name = editListName.trim();
        if (id === null || !name) return;
        const updated = await somedayListStore.update(id, { name });
        if (!updated) {
            notificationStore.push(i18nStore.t('someday.renameFailed'), { kind: 'error' });
            return; // keep the editor open with the text
        }
        if (editingListId === id) {
            editingListId = null;
            editListName = '';
        }
    }

    function cancelRenameList() {
        editingListId = null;
        editListName = '';
    }

    function handleRenameKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitRenameList();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelRenameList();
        }
    }

    async function handleDeleteList(id: string) {
        const list = activeTabLists.find(l => l.id === id);
        if (!list) return;
        const tasks = listTasks(list);
        const taskCount = tasks.length;
        const msg =
            taskCount > 0
                ? i18nStore.t('someday.deleteListConfirmTasks', { name: list.name, count: taskCount })
                : i18nStore.t('someday.deleteListConfirmEmpty', { name: list.name });
        if (!(await uiStore.confirm(msg))) return;

        // KNOWN ROUGH EDGE (design debt, deliberate for now): the tasks go
        // one by one, so a list delete costs N HTTP round-trips and N
        // separate undo entries (the toast history restores them one at a
        // time, newest first). A batch delete endpoint collapses both.
        for (const task of [...tasks]) {
            await taskStore.remove(task.id);
        }
        await somedayListStore.remove(id);
    }

    function handleTaskCreated(id: string) {
        newlyCreated.add(id);
    }
</script>

{#if isCollapsed}
    <!-- The strip is a visual sliver; the expand button inside carries its
         own accessible name, so the wrapper needs no role (a separator
         would wrongly mark a focusable-control container). -->
    <div class="collapsed-strip">
        <button class="expand-btn" onclick={() => preferencesStore.toggleSomeDayPanel()} use:tooltip={{ label: i18nStore.t('someday.openPanel'), shortcut: 'toggleSomedayPanel' }} aria-label={i18nStore.t('someday.openPanel')}>
            <svg width="10" height="18" viewBox="0 0 10 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="8,2 2,9 8,16" />
            </svg>
        </button>
    </div>
{:else}
    <aside class="someday-panel" class:resizing={isResizing} style="--someday-width: {preferencesStore.someDayPanelWidth}px" aria-label={i18nStore.t('someday.panelAria')}>
        <!-- Mouse-only by design: the panel itself is fully keyboard-
             operable via the Cmd/Ctrl+\ toggle (width restore), so a
             pointer-only drag handle leaves no keyboard user stranded;
             a dedicated keyboard-resize interaction is future work. -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div class="resize-handle" role="separator" aria-orientation="vertical" aria-label={i18nStore.t('someday.resizePanel')} use:tooltip={{ label: i18nStore.t('common.dragToResize') }} onmousedown={startResize}></div>
        <div
            class="panel-content"
            role="region"
            aria-label={i18nStore.t('someday.listsRegion')}
            ondragover={(e) => showUnlisted && zoneDragOver(UNLISTED_ZONE, e, listEls[UNLISTED_ZONE])}
            ondragleave={(e) => showUnlisted && zoneDragLeave(UNLISTED_ZONE, e, e.currentTarget)}
            ondrop={(e) => showUnlisted && zoneDrop(unlistedTasks, null, e)}
        >
            <div class="panel-header">
                <div class="panel-actions">
                    {#if showAddListForm}
                        <div class="new-list-form">
                            <input
                                bind:this={newListInput}
                                bind:value={newListName}
                                class="new-list-input"
                                placeholder={i18nStore.t('someday.listNamePlaceholder')}
                                aria-label={i18nStore.t('someday.newListName')}
                                onkeydown={handleNewListKeydown}
                                onblur={() => { if (!newListName.trim()) cancelNewList(); }}
                            />
                            <button class="icon-btn" onclick={submitNewList} use:tooltip={{ label: i18nStore.t('someday.createList') }} aria-label={i18nStore.t('someday.createList')}>
                                <Icon src={LuCheck} size={14} />
                            </button>
                        </div>
                    {:else}
                        <button class="add-list-btn" onclick={() => (showAddListForm = true)} use:tooltip={{ label: i18nStore.t('someday.addList') }} aria-label={i18nStore.t('someday.addList')}>
                            {i18nStore.t('someday.addListVisible')}
                        </button>
                    {/if}
                </div>
                <div class="panel-actions">
                    <!-- The v0.4.0 spec's collapse button: the only close
                         affordance that works on touch (the resize handle's
                         snap-shut is pointer-fine only, and Cmd/Ctrl+\ needs
                         a keyboard). -->
                    <button class="icon-btn" onclick={() => preferencesStore.toggleSomeDayPanel()} use:tooltip={{ label: i18nStore.t('someday.collapsePanel'), shortcut: 'toggleSomedayPanel' }} aria-label={i18nStore.t('someday.collapsePanel')}>
                        <Icon src={LuChevronRight} size={14} />
                    </button>
                </div>
            </div>

            <div class="tab-strip" role="group" aria-label={i18nStore.t('someday.tabsRegion')}>
                {#each tabs as tab (tab.id)}
                    {@const isActive = activeTab?.id === tab.id}
                    {#if editingTabId === tab.id}
                        <input
                            bind:this={editTabInput}
                            class="tab-rename-input"
                            value={tab.name}
                            aria-label={i18nStore.t('someday.renameTab')}
                            onkeydown={(e) => handleRenameTabKeydown(e, tab)}
                            onblur={() => cancelRenameTab()}
                        />
                    {:else}
                        <div class="tab-chip" class:active={isActive}>
                            <button
                                class="tab-btn"
                                class:hidden-label={!showTabLabels}
                                aria-current={isActive ? 'page' : undefined}
                                onclick={() => switchTab(tab.id)}
                            >
                                {tab.name}
                            </button>
                            {#if isActive}
                                <div class="tab-actions">
                                    <button class="icon-btn" onclick={() => (editingTabId = tab.id)} use:tooltip={{ label: i18nStore.t('someday.renameTab') }} aria-label={i18nStore.t('someday.renameTab')}>
                                        <Icon src={LuPencil} size={11} />
                                    </button>
                                    {#if tab.id !== DEFAULT_SOMEDAY_TAB_ID}
                                        <button class="icon-btn icon-btn-danger" onclick={() => handleDeleteTab(tab)} use:tooltip={{ label: i18nStore.t('someday.deleteTab') }} aria-label={i18nStore.t('someday.deleteTab')}>
                                            <Icon src={LuTrash2} size={11} />
                                        </button>
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    {/if}
                {/each}
                {#if showAddTabForm}
                    <div class="new-tab-form">
                        <input
                            bind:this={newTabInput}
                            bind:value={newTabName}
                            class="new-tab-input"
                            placeholder={i18nStore.t('someday.tabNamePlaceholder')}
                            aria-label={i18nStore.t('someday.newTabName')}
                            onkeydown={handleNewTabKeydown}
                            onblur={() => { if (!newTabName.trim()) cancelNewTab(); }}
                        />
                        <button class="icon-btn" onclick={submitNewTab} use:tooltip={{ label: i18nStore.t('someday.createTab') }} aria-label={i18nStore.t('someday.createTab')}>
                            <Icon src={LuCheck} size={12} />
                        </button>
                    </div>
                {:else}
                    <button class="add-tab-btn" onclick={() => (showAddTabForm = true)} use:tooltip={{ label: i18nStore.t('someday.addTab') }} aria-label={i18nStore.t('someday.addTab')}>
                        +
                    </button>
                {/if}
            </div>

            <div class="groups-container" role="list" aria-label={i18nStore.t('someday.listsRegion')}>
                {#each activeTabLists as list (list.id)}
                    {@const tasks = listTasks(list)}
                    {@const taskCount = tasks.length}
                    {@const completedCount = tasks.filter(t => t.completed).length}
                    {@const sectionId = `someday-${list.id}`}
                    {@const zone = `someday-list:${list.id}`}
                    {@const indicator = indicatorBeforeId(zone, tasks)}

                    <div
                        class="someday-group"
                        class:drop-target={dragStore.overZone === zone && dragStore.draggingTask !== null}
                        role="listitem"
                        ondragover={(e) => zoneDragOver(zone, e, listEls[list.id])}
                        ondragleave={(e) => zoneDragLeave(zone, e, e.currentTarget)}
                        ondrop={(e) => zoneDrop(tasks, list.id, e)}
                    >
                        {#if editingListId === list.id}
                            <div class="group-rename-row">
                                <input
                                    bind:this={editListInput}
                                    bind:value={editListName}
                                    class="rename-input"
                                    aria-label={i18nStore.t('someday.renameList')}
                                    onkeydown={handleRenameKeydown}
                                    onblur={commitRenameList}
                                />
                                <button class="icon-btn" onclick={commitRenameList} use:tooltip={{ label: i18nStore.t('someday.saveRenameHint') }} aria-label={i18nStore.t('someday.saveRename')}>
                                    <Icon src={LuCheck} size={13} />
                                </button>
                                <button class="icon-btn" onclick={cancelRenameList} use:tooltip={{ label: i18nStore.t('someday.cancelRenameHint') }} aria-label={i18nStore.t('someday.cancelRename')}>
                                    &#x2715;
                                </button>
                            </div>
                        {:else}
                            <div class="group-header-row">
                                <SectionHeader
                                    {sectionId}
                                    title={list.name}
                                    {taskCount}
                                    {completedCount}
                                />
                                {#if activeTab?.projectTag}
                                    <button
                                        class="tab-project-chip"
                                        onclick={(e) => {
                                            e.stopPropagation();
                                            openProjectHomeByTag(activeTab!.projectTag!);
                                        }}
                                        aria-label={i18nStore.t('someday.projectChip', { tag: activeTab!.projectTag! })}
                                    >
                                        #{activeTab!.projectTag}
                                    </button>
                                {/if}
                                <div class="group-actions">
                                    <button class="icon-btn" onclick={() => startRenameList(list)} use:tooltip={{ label: i18nStore.t('someday.renameList') }} aria-label={i18nStore.t('someday.renameList')}>
                                        <Icon src={LuPencil} size={13} />
                                    </button>
                                    <button class="icon-btn icon-btn-danger" onclick={() => handleDeleteList(list.id)} use:tooltip={{ label: i18nStore.t('someday.deleteList') }} aria-label={i18nStore.t('someday.deleteList')}>
                                        <Icon src={LuTrash2} size={13} />
                                    </button>
                                </div>
                            </div>
                        {/if}
                        <div class="group-tasks" role="list" bind:this={listEls[list.id]}>
                            {#each tasks as task (task.id)}
                                <div
                                    class="task-row-wrapper"
                                    data-task-id={task.id}
                                    class:drop-before={indicator === task.id}
                                >
                                    <TaskRow {task} isNew={newlyCreated.has(task.id)} />
                                </div>
                            {/each}
                        </div>
                        <InlineAddTask date="" somedayListId={list.id} autoTag={activeTab?.projectTag ?? null} oncreated={handleTaskCreated} />
                    </div>
                {:else}
                    <p class="empty-state">{i18nStore.t('someday.emptyState')}</p>
                {/each}

                {#if showUnlisted && unlistedTasks.length > 0}
                    {@const zone = UNLISTED_ZONE}
                    {@const indicator = indicatorBeforeId(zone, unlistedTasks)}
                    <div
                        class="someday-group"
                        class:drop-target={dragStore.overZone === zone && dragStore.draggingTask !== null}
                        role="listitem"
                        ondragover={(e) => zoneDragOver(zone, e, listEls[UNLISTED_ZONE])}
                        ondragleave={(e) => zoneDragLeave(zone, e, e.currentTarget)}
                        ondrop={(e) => zoneDrop(unlistedTasks, null, e)}
                    >
                        <div class="group-header-row">
                            <SectionHeader
                                sectionId="someday-unlisted"
                                title={i18nStore.t('someday.unlisted')}
                                taskCount={unlistedTasks.length}
                                completedCount={unlistedTasks.filter(t => t.completed).length}
                            />
                        </div>
                        <div class="group-tasks" role="list" bind:this={listEls[UNLISTED_ZONE]}>
                            {#each unlistedTasks as task (task.id)}
                                <div
                                    class="task-row-wrapper"
                                    data-task-id={task.id}
                                    class:drop-before={indicator === task.id}
                                >
                                    <TaskRow {task} isNew={newlyCreated.has(task.id)} />
                                </div>
                            {/each}
                        </div>
                        <InlineAddTask date="" oncreated={handleTaskCreated} />
                    </div>
                {/if}
            </div>
        </div>
    </aside>
{/if}

<style>
    .collapsed-strip {
        width: 24px;
        min-width: 24px;
        background: var(--color-surface);
        border-inline-start: 1px solid var(--color-border);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: col-resize;
        transition: background-color 0.15s;
    }

    .collapsed-strip:hover {
        background: var(--color-surface-hover);
    }

    .expand-btn {
        background: none;
        border: none;
        color: var(--color-text-secondary);
        cursor: pointer;
        padding: 4px 2px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.15s, background-color 0.15s;
    }

    .expand-btn:hover {
        color: var(--color-accent);
        background: var(--color-surface-hover);
    }

    .someday-panel {
        position: relative;
        width: var(--someday-width);
        min-width: 200px;
        max-width: 600px;
        background: var(--color-surface);
        display: flex;
        flex-direction: row;
        transition: width 0.2s ease;
    }

    .someday-panel.resizing {
        transition: none;
    }

    /* Tablet: the 600px cap is half an 800px screen -- clamp the panel
       to the viewport share instead so the day list keeps room. */
    @media (min-width: 768px) and (max-width: 1024px) {
        .someday-panel {
            max-width: 45vw;
        }
    }

    /* Mobile: the open panel stops squeezing the layout and floats as
       a full-height right sheet over the full-width day list. The
       bottom bar stays visible below it; the resize handle is
       meaningless on an overlay (the header collapse button closes). */
    @media (max-width: 767px) {
        .someday-panel {
            position: fixed;
            top: 0;
            inset-inline-end: 0;
            bottom: 40px;
            width: min(85vw, 400px);
            min-width: 0;
            z-index: 900;
            box-shadow: var(--shadow-panel);
        }

        .resize-handle {
            display: none;
        }
    }

    .resize-handle {
        position: absolute;
        top: 0;
        inset-inline-start: -3px;
        width: 6px;
        height: 100%;
        cursor: col-resize;
        z-index: 10;
        border-radius: 2px;
        transition: background-color 0.15s;
    }

    .resize-handle:hover,
    .resize-handle:active {
        background: var(--color-accent);
        opacity: 0.5;
    }

    .panel-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-inline-start: 1px solid var(--color-border);
    }

    .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 12px 8px;
    }

    .panel-actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .add-list-btn {
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

    .new-list-form {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .new-list-input {
        font-size: 12px;
        padding: 2px 6px;
        border: 1px solid var(--color-accent);
        border-radius: 4px;
        outline: none;
        background: var(--color-surface);
        color: var(--color-text);
        width: 120px;
    }

    .new-list-input::placeholder {
        color: var(--color-text-muted);
    }

    /* Tabs: a quiet strip under the header row. */
    .tab-strip {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 0 12px 8px;
        border-bottom: 1px solid var(--color-border);
        flex-wrap: wrap;
    }

    .tab-chip {
        display: flex;
        align-items: center;
        gap: 2px;
    }

    .tab-btn {
        background: none;
        border: none;
        font-size: 12px;
        color: var(--color-text-secondary);
        cursor: pointer;
        padding: 3px 8px;
        border-radius: 4px;
        transition: color 0.15s, background-color 0.15s;
        white-space: nowrap;
    }

    .tab-btn:hover {
        color: var(--color-text);
        background: var(--color-surface-hover);
    }

    .tab-chip .tab-btn[aria-current='page'] {
        color: var(--color-text);
        background: color-mix(in oklab, var(--color-accent) 14%, transparent);
        font-weight: 600;
    }

    /* The lone default tab carries no visible label (the area has no
       title -- USE-16); the active state keeps it findable. */
    .tab-btn.hidden-label {
        font-size: 0;
        padding-inline: 8px;
    }

    .tab-btn.hidden-label::before {
        content: '\2022';
        font-size: 14px;
        line-height: 1;
    }

    .tab-actions {
        display: flex;
        align-items: center;
        gap: 1px;
        opacity: 0;
        transition: opacity 0.15s;
    }

    .tab-chip:hover .tab-actions,
    .tab-actions:focus-within {
        opacity: 1;
    }

    .tab-rename-input,
    .new-tab-input {
        font-size: 12px;
        padding: 2px 6px;
        border: 1px solid var(--color-accent);
        border-radius: 4px;
        outline: none;
        background: var(--color-surface);
        color: var(--color-text);
        width: 100px;
    }

    .new-tab-form {
        display: flex;
        align-items: center;
        gap: 2px;
    }

    .add-tab-btn {
        background: none;
        border: none;
        font-size: 14px;
        color: var(--color-text-muted);
        cursor: pointer;
        padding: 1px 8px;
        border-radius: 4px;
        transition: color 0.15s, background-color 0.15s;
    }

    .add-tab-btn:hover {
        color: var(--color-text);
        background: var(--color-surface-hover);
    }

    .icon-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--color-text-muted);
        padding: 2px;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.15s, background-color 0.15s;
    }

    .icon-btn:hover {
        color: var(--color-text);
        background: var(--color-surface-hover);
    }

    .icon-btn-danger:hover {
        color: var(--color-danger);
    }

    /* A list under a project tab carries the project's chip (USE-17):
       the link hops to the project home. */
    .tab-project-chip {
        flex-shrink: 0;
        font-size: 11px;
        color: var(--color-text-secondary);
        background: var(--color-surface-dim);
        border: 1px solid var(--color-border);
        border-radius: 4px;
        padding: 1px 6px;
        cursor: pointer;
        transition: color 0.15s, border-color 0.15s;
    }

    .tab-project-chip:hover {
        color: var(--color-accent);
        border-color: var(--color-accent);
    }

    .group-header-row {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .group-header-row :global(.section-header) {
        flex: 1;
        min-width: 0;
    }

    .group-actions {
        display: flex;
        align-items: center;
        gap: 2px;
        flex-shrink: 0;
        opacity: 0;
        transition: opacity 0.15s;
    }

    /* Keyboard focus reveals the group actions too (USE-9). */
    .someday-group:hover .group-actions,
    .group-actions:focus-within {
        opacity: 1;
    }

    .group-rename-row {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 4px 0;
        border-bottom: 1px solid var(--color-border);
    }

    .rename-input {
        font-size: 13px;
        font-weight: 500;
        padding: 1px 4px;
        border: 1px solid var(--color-accent);
        border-radius: 4px;
        outline: none;
        background: var(--color-surface);
        color: var(--color-text);
        flex: 1;
    }

    .groups-container {
        flex: 1;
        overflow-y: auto;
        padding: 8px 0;
    }

    .someday-group {
        margin-bottom: 16px;
        padding: 0 12px;
    }

    /* Drop-zone highlight + insertion line (same treatment as the day
       sections; see DaySection.svelte). */
    .someday-group.drop-target {
        background: color-mix(in oklab, var(--color-accent) 7%, transparent);
        border-radius: 8px;
    }

    .task-row-wrapper.drop-before {
        box-shadow: inset 0 2px 0 0 var(--color-accent);
    }

    .group-tasks {
        display: flex;
        flex-direction: column;
    }

    .empty-state {
        font-size: 13px;
        color: var(--color-text-secondary);
        text-align: center;
        padding: 20px 12px;
    }
</style>
