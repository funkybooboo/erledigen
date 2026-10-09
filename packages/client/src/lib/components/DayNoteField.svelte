<script lang="ts">
    /**
     * DayNoteField -- the paper calendar's margin (v0.10.0).
     *
     * One live-markdown note per day, rendered in the day section below
     * the header. Collapsed when empty: a quiet "+ note" affordance;
     * the note itself is never a task and never reorders anything.
     *
     * Saves are debounced (the jot is continuous; the network is not):
     * an emptied note DELETES the row after the debounce, so clearing
     * and retyping within the window does not churn delete+create.
     */

    import { onDestroy, tick } from 'svelte';
    import LiveMarkdownEditor from './LiveMarkdownEditor.svelte';
    import { dayNoteStore } from '$lib/stores';
    import type { DayNote } from '@erledigen/shared';
    import { Icon } from 'svelte-icons-pack';
    import { LuStickyNote } from 'svelte-icons-pack/lu';
    import { i18nStore } from '$lib/i18n/i18nStore.svelte';

    let { dateStr, label }: { dateStr: string; label: string } = $props();

    const SAVE_DEBOUNCE_MS = 800;

    let note = $derived<DayNote | null>(dayNoteStore.byDate(dateStr));

    // The affordance's "creating" state: the editor is mounted for a
    // brand-new (still empty) note. It collapses back on the first
    // empty commit -- a jot that never became text never existed.
    let creating = $state(false);

    // Local working text: seeded from the store while clean, owned by
    // the editor while dirty (an unsaved keystroke must never be
    // clobbered by the WS echo of the PREVIOUS save).
    let text = $state('');
    let dirty = $state(false);

    let editor = $state<LiveMarkdownEditor | undefined>(undefined);

    let showEditor = $derived(note !== null || text.trim() !== '' || creating);

    $effect(() => {
        if (!dirty) {
            text = note?.notes ?? '';
        }
    });


    /** Enter the creating state and jump straight into the raw line.
     *  Imperative on purpose: a reactive effect calling into the editor
     *  would track the editor's OWN state through the method call and
     *  re-run on every structural edit, resetting the caret to line 0
     *  (the bug this replaced). */
    async function startCreating(): Promise<void> {
        creating = true;
        await tick();
        editor?.startEditing(0);
    }

    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    onDestroy(() => {
        if (saveTimer) clearTimeout(saveTimer);
    });

    function handleChange(value: string): void {
        text = value;
        dirty = true;
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveTimer = null;
            void commit();
        }, SAVE_DEBOUNCE_MS);
    }

    async function commit(): Promise<void> {
        // Snapshot the text BEFORE awaiting (Svelte state can shift
        // mid-handler -- the repo's async-handler rule).
        const value = text;
        const exists = dayNoteStore.byDate(dateStr) !== null;
        if (value.trim() === '') {
            creating = false;
            if (exists) await dayNoteStore.remove(dateStr);
        } else {
            const saved = await dayNoteStore.upsert(dateStr, value);
            // Only clear dirty when the server round-tripped exactly
            // what we hold -- a faster WS echo for a newer local edit
            // must stay sovereign.
            if (saved !== null && text === value) dirty = false;
        }
    }
</script>

<div class="day-note">
    {#if showEditor}
        <span class="day-note-icon" aria-hidden="true">
            <Icon src={LuStickyNote} />
        </span>
        <LiveMarkdownEditor
            bind:this={editor}
            value={text}
            onchange={handleChange}
            placeholder={i18nStore.t('dayNote.placeholder')}
            ariaLabel={i18nStore.t('dayNote.ariaLabel', { label })}
        />
    {:else}
        <!-- Collapsed when empty: a quiet affordance, not a task. -->
        <button
            class="day-note-affordance"
            onclick={startCreating}
            aria-label={i18nStore.t('dayNote.addNote', { label })}
        >
            <Icon src={LuStickyNote} />
            {i18nStore.t('dayNote.affordance')}
        </button>
    {/if}
</div>

<style>
    .day-note {
        display: flex;
        gap: 8px;
        margin: 2px 0 10px;
        align-items: flex-start;
    }

    /* The margin note reads quieter than tasks: secondary ink, small
       icon, indented under the header like handwriting in the margin. */
    .day-note-icon {
        color: var(--color-text-muted);
        margin-top: 3px;
        flex-shrink: 0;
    }

    .day-note-icon :global(svg) {
        width: 13px;
        height: 13px;
    }

    .day-note :global(.live-markdown) {
        flex: 1;
        min-width: 0;
        color: var(--color-text-secondary);
        font-size: 13px;
    }

    .day-note-affordance {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        margin-left: 1px;
        padding: 2px 6px 2px 1px;
        border: none;
        border-radius: 6px;
        background: none;
        color: var(--color-text-secondary);
        font-size: 12px;
        cursor: pointer;
        transition: color 0.15s;
    }

    .day-note-affordance :global(svg) {
        width: 12px;
        height: 12px;
    }

    /* Quiet by ink grade alone -- the old 55% opacity trick put the
       label below AA contrast in both themes (USE-11). */
    .day-note-affordance:hover,
    .day-note-affordance:focus-visible {
        color: var(--color-text);
    }

    .day-note-affordance:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
    }
</style>