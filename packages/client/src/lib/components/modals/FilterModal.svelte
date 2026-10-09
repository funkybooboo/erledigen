<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import { preferencesStore, tagStore } from '$lib/stores';
    import { tagChipStyle } from '$lib/tagColors';
    import type { ActiveFilters } from '@erledigen/shared';
    import { onMount } from 'svelte';

    let { onclose = () => {} }: { onclose?: () => void } = $props();

    let tags = $derived(tagStore.tags);
    let activeTags = $derived(preferencesStore.activeFilters.tags);

    let tagInput = $state('');
    let showSuggestions = $state(false);

    let suggestions = $derived.by(() => {
        if (!tagInput.trim()) return [];
        const lower = tagInput.trim().toLowerCase();
        return tags.filter(t => !activeTags.includes(t) && t.toLowerCase().includes(lower));
    });

    function addTag(tag: string) {
        const trimmed = tag.trim().toLowerCase();
        if (!trimmed || activeTags.includes(trimmed)) return;
        preferencesStore.setTags([...activeTags, trimmed]);
        tagInput = '';
        showSuggestions = false;
    }

    function removeTag(tag: string) {
        preferencesStore.setTags(activeTags.filter(t => t !== tag));
    }

    function setSortMode(mode: ActiveFilters['sortMode']) {
        preferencesStore.setSortMode(mode);
    }

    function handleDateChange(which: 'dateFrom' | 'dateTo', event: Event) {
        const value = (event.currentTarget as HTMLInputElement).value || null;
        preferencesStore.setDateRange(
            which === 'dateFrom' ? value : preferencesStore.activeFilters.dateFrom,
            which === 'dateTo' ? value : preferencesStore.activeFilters.dateTo,
        );
    }

    function clearDateRange() {
        preferencesStore.setDateRange(null, null);
    }

    function handleInputKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (suggestions.length === 1) {
                addTag(suggestions[0]);
            } else if (tagInput.trim()) {
                addTag(tagInput.trim());
            }
        } else if (e.key === 'Escape') {
            showSuggestions = false;
        }
    }

    onMount(() => {
        tagStore.fetchAll();
    });
</script>

<Modal title="Filter" onclose={onclose}>
    <div class="filter">
        <fieldset class="section" aria-labelledby="filter-tags-heading">
            <legend class="modal-section-heading" id="filter-tags-heading">Tags</legend>

            {#if activeTags.length > 0}
                <div class="active-tags">
                    {#each activeTags as tag (tag)}
                        <button class="tag-pill" style={tagChipStyle(tag) || undefined} onclick={() => removeTag(tag)}>
                            #{tag}
                            <span class="tag-remove">&times;</span>
                        </button>
                    {/each}
                </div>
            {/if}

            <div class="tag-input-row">
                <input
                    type="text"
                    class="tag-input"
                    placeholder="Add tag..."
                    bind:value={tagInput}
                    onkeydown={handleInputKeydown}
                    onfocus={() => showSuggestions = true}
                    onblur={() => setTimeout(() => showSuggestions = false, 150)}
                    id="filter-tag-input"
                />
                <button class="add-btn" onclick={() => addTag(tagInput)} disabled={!tagInput.trim()}>
                    +
                </button>
            </div>

            {#if showSuggestions && suggestions.length > 0}
                <ul class="suggestions">
                    {#each suggestions as tag (tag)}
                        <li>
                            <button class="suggestion-item" style={tagChipStyle(tag) || undefined} onclick={() => addTag(tag)}>
                                #{tag}
                            </button>
                        </li>
                    {/each}
                </ul>
            {/if}

            {#if tags.length > 0}
                <div class="available-tags">
                    {#each tags as tag (tag)}
                        {#if !activeTags.includes(tag)}
                            <button class="tag-option" style={tagChipStyle(tag) || undefined} onclick={() => addTag(tag)}>
                                #{tag}
                            </button>
                        {/if}
                    {/each}
                </div>
            {/if}
        </fieldset>

        <fieldset class="section" aria-labelledby="filter-sort-heading">
            <legend class="modal-section-heading" id="filter-sort-heading">Sort</legend>
            <div class="sort-options" role="radiogroup" aria-labelledby="filter-sort-heading">
                <label class="sort-option">
                    <input
                        type="radio"
                        name="sort-mode"
                        value="manual"
                        checked={preferencesStore.activeFilters.sortMode !== 'priority'}
                        onchange={() => setSortMode('manual')}
                    />
                    Default order
                </label>
                <label class="sort-option">
                    <input
                        type="radio"
                        name="sort-mode"
                        value="priority"
                        checked={preferencesStore.activeFilters.sortMode === 'priority'}
                        onchange={() => setSortMode('priority')}
                    />
                    Priority (#p1 first)
                </label>
            </div>
        </fieldset>

        <fieldset class="section" aria-labelledby="filter-range-heading">
            <legend class="modal-section-heading" id="filter-range-heading">Date range</legend>
            <div class="range-row">
                <label class="range-label">
                    From
                    <input
                        type="date"
                        class="range-input"
                        value={preferencesStore.activeFilters.dateFrom ?? ''}
                        onchange={e => handleDateChange('dateFrom', e)}
                    />
                </label>
                <label class="range-label">
                    To
                    <input
                        type="date"
                        class="range-input"
                        value={preferencesStore.activeFilters.dateTo ?? ''}
                        onchange={e => handleDateChange('dateTo', e)}
                    />
                </label>
                <button
                    class="range-clear"
                    onclick={clearDateRange}
                    disabled={
                        preferencesStore.activeFilters.dateFrom === null &&
                        preferencesStore.activeFilters.dateTo === null
                    }
                >
                    Clear
                </button>
            </div>
        </fieldset>

        <button class="clear-btn" onclick={() => preferencesStore.clearAll()}>
            Clear all filters
        </button>
    </div>
</Modal>

<style>
    .filter {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    fieldset.section {
        border: none;
        padding: 0;
        margin: 0;
    }

    .active-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 8px;
    }

    .tag-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--color-accent-light);
        border: 1px solid var(--color-accent);
        border-radius: 14px;
        padding: 4px 10px;
        font-size: 12px;
        cursor: pointer;
        color: var(--color-accent);
        transition: all 0.15s;
    }

    /* A colored tag keeps its own tint (tagChipStyle sets color,
       background, and border-color) and only inherits the shape. */

    .tag-pill:hover {
        opacity: 0.8;
    }

    .tag-remove {
        font-size: 14px;
        line-height: 1;
        margin-left: 2px;
    }

    .tag-input-row {
        display: flex;
        gap: 6px;
        align-items: center;
    }

    .tag-input {
        flex: 1;
        font-size: 13px;
        padding: 6px 10px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-surface);
        color: var(--color-text);
        outline: none;
        transition: border-color 0.15s;
    }

    .tag-input:focus {
        border-color: var(--color-accent);
    }

    .tag-input::placeholder {
        color: var(--color-text-muted);
    }

    .add-btn {
        background: var(--color-accent);
        color: var(--color-on-accent);
        border: none;
        border-radius: 999px;
        width: 32px;
        height: 32px;
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.15s;
    }

    .add-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .add-btn:not(:disabled):hover {
        opacity: 0.9;
    }

    .suggestions {
        list-style: none;
        margin: 4px 0 0;
        padding: 0;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-surface);
        max-height: 150px;
        overflow-y: auto;
    }

    .suggestion-item {
        display: block;
        width: 100%;
        text-align: left;
        background: none;
        border: none;
        padding: 6px 10px;
        font-size: 12px;
        cursor: pointer;
        color: var(--color-text-secondary);
        transition: background-color 0.1s;
    }

    .suggestion-item:hover {
        background: var(--color-surface-hover);
    }

    .available-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
    }

    .sort-options {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .sort-option {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--color-text);
        cursor: pointer;
    }

    .range-row {
        display: flex;
        align-items: flex-end;
        gap: 12px;
        flex-wrap: wrap;
    }

    .range-label {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 12px;
        color: var(--color-text-secondary);
    }

    .range-input {
        font-size: 13px;
        padding: 6px 8px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-surface);
        color: var(--color-text);
        outline: none;
    }

    .range-input:focus {
        border-color: var(--color-accent);
    }

    .range-clear {
        background: none;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        color: var(--color-text-secondary);
        transition: all 0.15s;
    }

    .range-clear:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .range-clear:not(:disabled):hover {
        background: var(--color-danger-light);
        border-color: var(--color-danger);
        color: var(--color-danger);
    }

    .tag-option {
        background: var(--color-surface-hover);
        border: 1px solid var(--color-border);
        border-radius: 14px;
        padding: 4px 10px;
        font-size: 12px;
        cursor: pointer;
        color: var(--color-text-secondary);
        transition: all 0.15s;
    }

    .tag-option:hover {
        background: var(--color-border);
    }

    .clear-btn {
        background: none;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        padding: 8px 16px;
        font-size: 13px;
        cursor: pointer;
        color: var(--color-text-secondary);
        transition: all 0.15s;
    }

    .clear-btn:hover {
        background: var(--color-danger-light);
        border-color: var(--color-danger);
        color: var(--color-danger);
    }
</style>