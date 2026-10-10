<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import { taskStore, uiStore, notificationStore, dateViewStore, preferencesStore } from '$lib/stores';
    import { createFromText, habitCreatedText } from '$lib/createFromText';
    import { deleteTaskWithUndo } from '$lib/taskActions';
    import { container } from '$lib/container';
    import {
        findTaskByText,
        normalizeTagInput,
        PALETTE_COMMANDS,
        parseMoveArgs,
        parseTagArgs,
        type PaletteCommand,
    } from '$lib/paletteCommands';
    import {
        describeRecurrence,
        parseRecurrence,
        resolveDatePhrase,
        type Task,
    } from '@erledigen/shared';
    import { Icon } from 'svelte-icons-pack';
    import { LuCheck, LuCircle, LuPlus, LuRepeat, LuX } from 'svelte-icons-pack/lu';
    import { onMount } from 'svelte';
    import { i18nStore } from '$lib/i18n/i18nStore.svelte';
    import { recurrencePhrases } from '$lib/i18n/recurrencePhrases';

    let { onclose = () => {} }: { onclose?: () => void } = $props();

    let query = $state('');
    let results = $state<Task[]>([]);
    let searchInput = $state<HTMLInputElement | undefined>(undefined);

    // Focus programmatically instead of the `autofocus` attribute: the
    // attribute form is an a11y anti-pattern (it steals focus from assistive
    // tech without context) and svelte-check flags it.
    onMount(() => {
        searchInput?.focus();
    });

    // --- command mode ----------------------------------------------------
    // A leading "/" turns the search box into a command palette. Commands
    // are typed "/<name> <args>"; Enter runs the selected command. The
    // metadata table lives in lib/paletteCommands.ts.

    let isCommandMode = $derived(query.trimStart().startsWith('/'));

    /** The query without the leading "/" (e.g. "add water plants"). */
    let commandQuery = $derived(query.trimStart().slice(1).trim());

    /** The typed command word and everything after it. */
    let commandWord = $derived((commandQuery.split(' ')[0] ?? '').toLowerCase());
    let commandArgs = $derived(commandQuery.split(' ').slice(1).join(' ').trim());

    /** Commands whose id prefixes the typed command word. */
    let matchingCommands = $derived.by(() => {
        if (!isCommandMode) return [];
        if (!commandWord) return [...PALETTE_COMMANDS];
        return PALETTE_COMMANDS.filter(cmd => cmd.id.startsWith(commandWord));
    });

    // --- keyboard selection ----------------------------------------------
    // Arrow keys move a selection over the rendered option rows (commands
    // in command mode, task results in search mode); Enter runs the selected
    // one. The input keeps DOM focus (combobox pattern), so
    // aria-activedescendant carries the selection to screen readers.

    let selectedIndex = $state(0);

    /** The selected command, or the first when none is highlighted. */
    let activeCommand = $derived(matchingCommands[selectedIndex] ?? matchingCommands[0] ?? null);

    /** Whether an action row (command + typed args) is rendered. */
    let hasActionRow = $derived(Boolean(activeCommand && commandArgs));

    /** Number of option rows currently rendered below the input. */
    let optionCount = $derived.by(() => {
        if (isCommandMode) {
            return hasActionRow ? 1 : matchingCommands.length;
        }
        return results.length;
    });

    // Any change to the query or the option list resets the selection.
    $effect(() => {
        void query;
        void optionCount;
        selectedIndex = 0;
    });

    function optionId(index: number): string {
        return `search-option-${index}`;
    }

    function moveSelection(delta: 1 | -1): void {
        const max = optionCount - 1;
        if (max < 0) return;
        selectedIndex = Math.min(max, Math.max(0, selectedIndex + delta));
        document.getElementById(optionId(selectedIndex))?.scrollIntoView({ block: 'nearest' });
    }

    // --- live hints on the action row -------------------------------------

    let addParsed = $derived(activeCommand?.id === 'add' && commandArgs ? parseRecurrence(commandArgs) : null);

    /** Resolved date shown next to "/go <date>". */
    let goDate = $derived(
        activeCommand?.id === 'go' && commandArgs
            ? resolveDatePhrase(commandArgs, container.dateProvider.today())
            : null,
    );

    /** Resolved date shown next to "/move <text> to <date>". */
    let moveDate = $derived.by(() => {
        if (activeCommand?.id !== 'move' || !commandArgs) return null;
        const parts = parseMoveArgs(commandArgs);
        return parts ? resolveDatePhrase(parts.date, container.dateProvider.today()) : null;
    });

    let running = $state(false);

    /** The icon the action row shows for a command. */
    let actionIcon = $derived.by(() => {
        switch (activeCommand?.id) {
            case 'add':
                return LuPlus;
            case 'complete':
                return LuCheck;
            case 'delete':
                return LuX;
            default:
                return LuCircle;
        }
    });

    async function runSelectedCommand() {
        const command = activeCommand;
        if (!command || running) return;
        // Enter on a bare argument-taking command stages it into the
        // input, ready for its argument.
        if (!command.noArgs && !commandArgs) {
            query = `/${command.id} `;
            return;
        }
        running = true;
        const ok = await dispatch(command, commandArgs);
        running = false;
        if (ok) uiStore.closeModal();
    }

    /** Run one command with its typed argument. Returns whether the
     *  palette should close (failures keep the query for a retry). */
    async function dispatch(command: PaletteCommand, args: string): Promise<boolean> {
        const today = container.dateProvider.today();
        switch (command.id) {
            case 'add': {
                const result = await createFromText(args, { date: today });
                if (!result) {
                    notificationStore.push(i18nStore.t('search.createFailed'), {
                        kind: 'error',
                    });
                    return false;
                }
                if (result.kind === 'habit') {
                    notificationStore.push(habitCreatedText(result.schedule), { kind: 'success' });
                } else if (result.task.date === today) {
                    notificationStore.push(i18nStore.t('search.addedToToday'), { kind: 'success' });
                } else if (result.task.date === null) {
                    notificationStore.push(i18nStore.t('search.addedToSomeday'), { kind: 'success' });
                } else {
                    notificationStore.push(i18nStore.t('search.addedToDate', { date: result.task.date }), {
                        kind: 'success',
                    });
                }
                return true;
            }
            case 'complete': {
                const task = findTaskByText(taskStore.tasks, args);
                if (!task) {
                    notificationStore.push(i18nStore.t('search.noMatch', { query: args }), { kind: 'error' });
                    return false;
                }
                const updated = await taskStore.update(task.id, { completed: true });
                if (!updated) {
                    notificationStore.push(i18nStore.t('search.couldNotComplete'), { kind: 'error' });
                    return false;
                }
                notificationStore.push(i18nStore.t('search.completed', { text: task.text }), { kind: 'success' });
                return true;
            }
            case 'delete': {
                const task = findTaskByText(taskStore.tasks, args);
                if (!task) {
                    notificationStore.push(i18nStore.t('search.noMatch', { query: args }), { kind: 'error' });
                    return false;
                }
                const outcome = await deleteTaskWithUndo(task);
                if (outcome === 'failed') {
                    notificationStore.push(i18nStore.t('search.couldNotDelete'), { kind: 'error' });
                }
                return outcome === 'deleted';
            }
            case 'move': {
                const parts = parseMoveArgs(args);
                if (!parts) {
                    notificationStore.push(i18nStore.t('search.moveUsage'), { kind: 'error' });
                    return false;
                }
                const task = findTaskByText(taskStore.tasks, parts.text);
                if (!task) {
                    notificationStore.push(i18nStore.t('search.noMatch', { query: parts.text }), { kind: 'error' });
                    return false;
                }
                const date = resolveDatePhrase(parts.date, today);
                if (!date) {
                    notificationStore.push(i18nStore.t('task.dateParseError', { value: parts.date }), {
                        kind: 'error',
                    });
                    return false;
                }
                const updated = await taskStore.update(task.id, { date });
                if (!updated) {
                    notificationStore.push(i18nStore.t('search.couldNotMove'), { kind: 'error' });
                    return false;
                }
                notificationStore.push(i18nStore.t('search.moved', { text: task.text, date }), { kind: 'success' });
                return true;
            }
            case 'go': {
                const date = resolveDatePhrase(args, today);
                if (!date) {
                    notificationStore.push(i18nStore.t('task.dateParseError', { value: args }), { kind: 'error' });
                    return false;
                }
                dateViewStore.requestScroll(date, true);
                return true;
            }
            case 'tag': {
                const parts = parseTagArgs(args);
                if (!parts) {
                    notificationStore.push(i18nStore.t('search.tagUsage'), { kind: 'error' });
                    return false;
                }
                const tag = normalizeTagInput(parts.tag);
                if (!tag) {
                    notificationStore.push(i18nStore.t('search.typeTagToAdd'), { kind: 'error' });
                    return false;
                }
                const task = findTaskByText(taskStore.tasks, parts.text);
                if (!task) {
                    notificationStore.push(i18nStore.t('search.noMatch', { query: parts.text }), { kind: 'error' });
                    return false;
                }
                if (!task.tags.includes(tag)) {
                    const updated = await taskStore.update(task.id, { tags: [...task.tags, tag] });
                    if (!updated) {
                        notificationStore.push(i18nStore.t('search.couldNotTag'), { kind: 'error' });
                        return false;
                    }
                }
                notificationStore.push(i18nStore.t('search.tagged', { text: task.text, tag }), { kind: 'success' });
                return true;
            }
            case 'filter': {
                const tag = normalizeTagInput(args);
                if (!tag) {
                    notificationStore.push(i18nStore.t('search.typeTagToFilter'), { kind: 'error' });
                    return false;
                }
                preferencesStore.setTags([tag]);
                return true;
            }
            case 'clear':
                preferencesStore.clearAll();
                return true;
            case 'today':
                dateViewStore.requestScroll(today, true);
                return true;
            case 'someday': {
                const task = findTaskByText(taskStore.tasks, args);
                if (!task) {
                    notificationStore.push(i18nStore.t('search.noMatch', { query: args }), { kind: 'error' });
                    return false;
                }
                const updated = await taskStore.update(task.id, { date: null });
                if (!updated) {
                    notificationStore.push(i18nStore.t('search.couldNotMove'), { kind: 'error' });
                    return false;
                }
                notificationStore.push(i18nStore.t('search.movedToSomeday', { text: task.text }), { kind: 'success' });
                return true;
            }
            case 'project':
                uiStore.openModal('projects');
                return true;
            case 'habit':
                uiStore.openModal('habits');
                return true;
            case 'settings':
                uiStore.openModal('settings');
                return true;
            case 'help':
                uiStore.openModal('help');
                return true;
            default:
                return false;
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            // Intercept only when options are rendered; with no results the
            // arrows keep moving the caret naturally in the input.
            if (optionCount > 0) {
                e.preventDefault();
                moveSelection(e.key === 'ArrowDown' ? 1 : -1);
            }
            return;
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (isCommandMode) {
                void runSelectedCommand();
            } else {
                const task = results[selectedIndex] ?? results[0];
                if (task) handleSelect(task);
            }
        }
    }

    // --- search mode ------------------------------------------------------

    $effect(() => {
        if (isCommandMode || !query.trim()) {
            results = [];
            return;
        }
        const q = query.toLowerCase();
        results = taskStore.tasks.filter(t =>
            t.text.toLowerCase().includes(q) ||
            t.tags.some(tag => tag.toLowerCase().includes(q)) ||
            (t.notes && t.notes.toLowerCase().includes(q))
        ).slice(0, 20);
    });

    function handleSelect(task: Task) {
        uiStore.focusTask(task.id);
        if (task.date) {
            const el = document.getElementById(`day-${task.date}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        uiStore.closeModal();
    }
</script>

<Modal title={i18nStore.t('modal.search')} onclose={onclose}>
    <div class="search">
        <input
            class="search-input"
            type="text"
            bind:this={searchInput}
            role="combobox"
            aria-expanded={optionCount > 0}
            aria-controls={optionCount > 0 ? 'search-results' : undefined}
            aria-activedescendant={optionCount > 0 ? optionId(selectedIndex) : undefined}
            bind:value={query}
            placeholder={i18nStore.t('search.placeholder')}
            aria-label={i18nStore.t('search.ariaLabel')}
            onkeydown={handleKeydown}
        />

        {#if isCommandMode}
            {#if hasActionRow && activeCommand}
                <ul class="results" role="listbox" id="search-results">
                    <li>
                        <button
                            class="result-item"
                            class:selected={selectedIndex === 0}
                            id={optionId(0)}
                            onclick={runSelectedCommand}
                            role="option"
                            aria-selected="true"
                        >
                            <span class="result-checkbox"><Icon src={actionIcon} /></span>
                            <span class="result-text">{activeCommand.label} {commandArgs}</span>
                            {#if addParsed}
                                <span class="command-hint">
                                    <Icon src={LuRepeat} />
                                    {describeRecurrence(addParsed.schedule, recurrencePhrases())}
                                </span>
                            {:else if goDate}
                                <span class="command-hint">{goDate}</span>
                            {:else if moveDate}
                                <span class="command-hint">{moveDate}</span>
                            {/if}
                        </button>
                    </li>
                </ul>
            {:else if matchingCommands.length > 0}
                <ul class="results" role="listbox" id="search-results">
                    {#each matchingCommands as command, i (command.id)}
                        <li>
                            <button
                                class="result-item"
                                class:selected={i === selectedIndex}
                                id={optionId(i)}
                                onclick={() => (query = `/${command.id} `)}
                                role="option"
                                aria-selected={i === selectedIndex}
                            >
                                <span class="command-name">{command.label}</span>
                                <span class="command-description">{i18nStore.t(command.descriptionKey)}</span>
                            </button>
                        </li>
                    {/each}
                </ul>
            {:else}
                <p class="empty">{i18nStore.t('search.noCommand')}</p>
            {/if}
        {:else if results.length > 0}
            <ul class="results" role="listbox" id="search-results">
                {#each results as task, i (task.id)}
                    <li>
                        <button
                            class="result-item"
                            class:selected={i === selectedIndex}
                            id={optionId(i)}
                            onclick={() => handleSelect(task)}
                            role="option"
                            aria-selected={i === selectedIndex}
                        >
                            <span class="result-checkbox">{#if task.completed}<Icon src={LuCheck} />{:else}<Icon src={LuCircle} />{/if}</span>
                            <span class="result-text" class:completed={task.completed}>{task.text}</span>
                            {#if task.date}
                                <span class="result-date">{task.date}</span>
                            {/if}
                            {#each task.tags as tag}
                                <span class="result-tag">#{tag}</span>
                            {/each}
                        </button>
                    </li>
                {/each}
            </ul>
        {:else if query.trim()}
            <p class="empty">{i18nStore.t('search.noResults')}</p>
        {:else}
            <p class="hint">{i18nStore.t('search.hint')}</p>
        {/if}
    </div>
</Modal>

<style>
    .search {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .search-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--color-border);
        border-radius: 8px;
        font-size: 14px;
        background: var(--color-surface-dim);
        color: var(--color-text);
        outline: none;
    }

    .search-input:focus {
        border-color: var(--color-accent);
    }

    .results {
        list-style: none;
        padding: 0;
        margin: 0;
        max-height: 400px;
        overflow-y: auto;
    }

    .result-item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 12px;
        background: none;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        text-align: left;
        color: var(--color-text);
        font-size: 14px;
        transition: background-color 0.1s;
    }

    .result-item:hover,
    .result-item.selected {
        background: var(--color-surface-hover);
    }

    .result-checkbox {
        color: var(--color-text-secondary);
        flex-shrink: 0;
    }

    .result-checkbox :global(svg) {
        width: 14px;
        height: 14px;
    }

    .result-text.completed {
        text-decoration: line-through;
        color: var(--color-text-secondary);
    }

    .result-date {
        font-size: 12px;
        color: var(--color-text-secondary);
        font-family: monospace;
    }

    .result-tag {
        font-size: 11px;
        padding: 1px 6px;
        border-radius: 10px;
        background: var(--color-surface-hover);
        color: var(--color-text-secondary);
    }

    .command-name {
        font-family: monospace;
        font-weight: 600;
        color: var(--color-accent);
        flex-shrink: 0;
    }

    .command-description {
        font-size: 12px;
        color: var(--color-text-secondary);
    }

    .command-hint {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
        margin-left: auto;
        padding: 1px 8px;
        border-radius: 999px;
        background: var(--color-accent-light);
        color: var(--color-accent);
        font-size: 11px;
        font-weight: 600;
        white-space: nowrap;
    }

    .command-hint :global(svg) {
        width: 11px;
        height: 11px;
    }

    .empty, .hint {
        color: var(--color-text-secondary);
        text-align: center;
        padding: 20px 0;
        font-size: 14px;
    }
</style>