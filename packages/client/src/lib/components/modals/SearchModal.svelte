<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import { taskStore, uiStore, notificationStore } from '$lib/stores';
    import { createFromText, habitCreatedText } from '$lib/createFromText';
    import { container } from '$lib/container';
    import { describeRecurrence, parseRecurrence, type Task } from '@erledigen/shared';
    import { Icon } from 'svelte-icons-pack';
    import { LuCheck, LuCircle, LuPlus, LuRepeat } from 'svelte-icons-pack/lu';
    import { onMount } from 'svelte';

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
    // are typed "/<name> <args>"; Enter runs the first listed command.

    interface Command {
        id: string;
        label: string;
        description: string;
    }

    const COMMANDS: Command[] = [
        {
            id: 'add',
            label: '/add',
            description: 'Add a task for today (habit phrases like "every day" become habits)',
        },
    ];

    let isCommandMode = $derived(query.trimStart().startsWith('/'));

    /** The query without the leading "/" (e.g. "add water plants"). */
    let commandQuery = $derived(query.trimStart().slice(1).trim());

    /** Commands whose id prefixes the typed command word. */
    let matchingCommands = $derived.by(() => {
        if (!isCommandMode) return [];
        const word = (commandQuery.split(' ')[0] ?? '').toLowerCase();
        if (!word) return [...COMMANDS];
        return COMMANDS.filter(cmd => cmd.id.startsWith(word));
    });

    /** The "/add" argument text, when the command is fully typed. */
    let addArgument = $derived.by(() => {
        if (!isCommandMode) return '';
        const parts = commandQuery.split(' ');
        const word = (parts[0] ?? '').toLowerCase();
        if (word !== 'add') return '';
        return parts.slice(1).join(' ').trim();
    });

    /** Live habit preview for the /add argument. */
    let addParsed = $derived(addArgument ? parseRecurrence(addArgument) : null);

    let running = $state(false);

    // --- keyboard selection ----------------------------------------------
    // Arrow keys move a selection over the rendered option rows (commands
    // in command mode, task results in search mode); Enter runs the selected
    // one. The input keeps DOM focus (combobox pattern), so
    // aria-activedescendant carries the selection to screen readers.

    let selectedIndex = $state(0);

    /** Number of option rows currently rendered below the input. */
    let optionCount = $derived.by(() => {
        if (isCommandMode) {
            if (addArgument) return matchingCommands.length > 0 ? 1 : 0;
            return matchingCommands.length;
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

    /** The selected command, or the first when none is highlighted. */
    let selectedCommand = $derived(matchingCommands[selectedIndex] ?? matchingCommands[0]);

    async function runSelectedCommand() {
        const command = selectedCommand;
        if (!command || running) return;
        if (command.id === 'add') {
            if (!addArgument) {
                // Enter on a bare command stages it into the input, ready
                // for its argument.
                query = `/${command.id} `;
                return;
            }
            running = true;
            const result = await createFromText(addArgument, {
                date: container.dateProvider.today(),
            });
            running = false;
            if (!result) {
                // Creation failed (network/server). The query is kept so the
                // user can retry; the toast says what happened.
                notificationStore.push('Could not create -- the text is kept', {
                    kind: 'error',
                });
                return;
            }
            if (result.kind === 'habit') {
                notificationStore.push(habitCreatedText(result.schedule), { kind: 'success' });
            } else {
                notificationStore.push('Task added to today', { kind: 'success' });
            }
            uiStore.closeModal();
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            moveSelection(e.key === 'ArrowDown' ? 1 : -1);
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

<Modal title="Search" onclose={onclose}>
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
            placeholder="Search tasks... (or type / for commands)"
            aria-label="Search tasks"
            onkeydown={handleKeydown}
        />

        {#if isCommandMode}
            {#if addArgument}
                <ul class="results" role="listbox" id="search-results">
                    {#if matchingCommands.length > 0}
                        <li>
                            <button
                                class="result-item"
                                class:selected={selectedIndex === 0}
                                id={optionId(0)}
                                onclick={runSelectedCommand}
                                role="option"
                                aria-selected="true"
                            >
                                <span class="result-checkbox"><Icon src={LuPlus} /></span>
                                <span class="result-text">Add: {addArgument}</span>
                                {#if addParsed}
                                    <span class="command-hint">
                                        <Icon src={LuRepeat} />
                                        {describeRecurrence(addParsed.schedule)}
                                    </span>
                                {/if}
                            </button>
                        </li>
                    {:else}
                        <li><p class="empty">No such command.</p></li>
                    {/if}
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
                                <span class="command-description">{command.description}</span>
                            </button>
                        </li>
                    {/each}
                </ul>
            {:else}
                <p class="empty">No such command.</p>
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
            <p class="empty">No tasks found.</p>
        {:else}
            <p class="hint">Type to search across task text, notes, and tags. Prefix with "/" to run a command like "/add water the plants".</p>
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
        color: var(--color-text-muted);
        flex-shrink: 0;
    }

    .result-checkbox :global(svg) {
        width: 14px;
        height: 14px;
    }

    .result-text.completed {
        text-decoration: line-through;
        color: var(--color-text-muted);
    }

    .result-date {
        font-size: 12px;
        color: var(--color-text-muted);
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
        color: var(--color-text-muted);
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
        color: var(--color-text-muted);
        text-align: center;
        padding: 20px 0;
        font-size: 14px;
    }
</style>