<script lang="ts">
    /**
     * LiveMarkdownEditor -- Obsidian-style live markdown (v0.10.0).
     *
     * The note renders as markdown everywhere EXCEPT the line under
     * the caret, which drops back to raw syntax in a single-line
     * textarea (the roadmap's live model). Structure edits (Enter
     * splits, Backspace-at-0 merges, list continuation, multi-line
     * paste) go through the pure ops in lib/liveLines.ts.
     *
     * Value flow: `value` in, `onchange` out -- fire-and-current, no
     * internal persistence. Parents update their state synchronously
     * on every onchange (they may debounce the NETWORK write, not the
     * state); while editing, local lines win over external value
     * changes (last writer wins at the persistence layer).
     */

    import { renderMarkdown } from '@erledigen/shared';
    import { mergeLineUp, pasteLines, splitLineAt, toLines } from '$lib/liveLines';

    interface Props {
        value: string;
        onchange: (value: string) => void;
        /** Idle placeholder for an empty note. */
        placeholder?: string;
        ariaLabel?: string;
    }

    let {
        value,
        onchange,
        placeholder = '',
        ariaLabel = 'Markdown notes',
    }: Props = $props();

    // svelte-ignore state_referenced_locally -- seeded ONCE from the
    // initial value on purpose; the effect below adopts external changes
    // (and deliberately not while editing -- see its comment).
    let lines = $state<string[]>(toLines(value));
    /** null = idle (fully rendered); otherwise the raw-syntax line. */
    let caretLine = $state<number | null>(null);
    let caretText = $state('');
    /** Caret column requested by a structural op (consumed on focus). */
    let pendingCol = $state(0);

    let textareaEl = $state<HTMLTextAreaElement | null>(null);

    // Adopt external value changes (WS sync, a reopened modal) only
    // while idle AND different from what we already hold -- editing
    // keeps local state sovereign, and a same-content reseed would
    // rebuild the DOM under the user for nothing.
    $effect(() => {
        if (caretLine === null && value !== lines.join('\n')) {
            lines = toLines(value);
        }
    });

    let idleHtml = $derived(renderMarkdown(lines.join('\n'), { withLineData: true }));
    let isEmpty = $derived(lines.every(l => l.trim() === ''));
    let beforeHtml = $derived(
        caretLine !== null && caretLine > 0
            ? renderMarkdown(lines.slice(0, caretLine).join('\n'), { withLineData: true })
            : '',
    );
    let afterHtml = $derived(
        caretLine !== null
            ? renderMarkdown(lines.slice(caretLine + 1).join('\n'), {
                  withLineData: true,
                  firstLine: caretLine + 1,
              })
            : '',
    );

    function fireChange(): void {
        onchange(lines.join('\n'));
    }

    function autosize(): void {
        const el = textareaEl;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }

    function startEdit(line: number, col = 0): void {
        caretLine = line;
        caretText = lines[line] ?? '';
        pendingCol = col;
    }

    function setCaret(line: number, col: number): void {
        caretLine = line;
        caretText = lines[line] ?? '';
        pendingCol = col;
    }

    // Focus + caret placement follows every structural caret move.
    $effect(() => {
        void caretLine;
        void pendingCol;
        if (caretLine !== null && textareaEl) {
            textareaEl.focus();
            textareaEl.setSelectionRange(pendingCol, pendingCol);
            autosize();
        }
    });

    function handleBlur(): void {
        caretLine = null;
        fireChange();
    }

    function handleInput(): void {
        const idx = caretLine;
        if (idx === null) return;
        lines[idx] = caretText;
        autosize();
        fireChange();
    }

    function applyOp(result: { lines: string[]; caretLine: number; caretCol: number }): void {
        lines = result.lines;
        setCaret(result.caretLine, result.caretCol);
        fireChange();
    }

    function handleKeydown(e: KeyboardEvent): void {
        const el = textareaEl;
        const idx = caretLine;
        if (!el || idx === null) return;
        const collapsed = el.selectionStart === el.selectionEnd;

        if (e.key === 'Enter') {
            e.preventDefault();
            applyOp(splitLineAt({ lines, caretLine: idx, caretCol: el.selectionStart }));
            return;
        }

        if (e.key === 'Backspace' && collapsed && el.selectionStart === 0) {
            const merged = mergeLineUp({ lines, caretLine: idx, caretCol: 0 });
            if (merged) {
                e.preventDefault();
                applyOp(merged);
            }
            return;
        }

        // Line-boundary arrow movement: within the wrapped textarea the
        // arrows stay native; at the first/last character they hop
        // logical lines.
        if (e.key === 'ArrowUp' && collapsed && el.selectionStart === 0 && idx > 0) {
            e.preventDefault();
            setCaret(idx - 1, (lines[idx - 1] ?? '').length);
            return;
        }
        if (
            e.key === 'ArrowDown' &&
            collapsed &&
            el.selectionStart === caretText.length &&
            idx < lines.length - 1
        ) {
            e.preventDefault();
            setCaret(idx + 1, 0);
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            // Escape settles the edit (blur commits); the global Esc
            // layering (close modal) must not also fire.
            e.stopPropagation();
            el.blur();
            return;
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            const start = el.selectionStart;
            const end = el.selectionEnd;
            el.setRangeText('  ', start, end, 'end');
            caretText = el.value;
            lines[idx] = caretText;
            fireChange();
        }
    }

    function handlePaste(e: ClipboardEvent): void {
        const el = textareaEl;
        const idx = caretLine;
        if (!el || idx === null) return;
        e.preventDefault();
        const text = e.clipboardData?.getData('text') ?? '';
        if (text === '') return;

        const start = el.selectionStart;
        const end = el.selectionEnd;
        const head = caretText.slice(0, start);
        const tail = caretText.slice(end);
        const pasted = pasteLines(text);
        const first = head + (pasted[0] ?? '');
        const last = (pasted[pasted.length - 1] ?? '') + tail;
        if (pasted.length === 1) {
            pasted[0] = first + tail;
        } else {
            pasted[0] = first;
            pasted[pasted.length - 1] = last;
        }

        const next = lines.slice();
        next.splice(idx, 1, ...pasted);
        lines = next;
        setCaret(idx + pasted.length - 1, last.length - tail.length);
        fireChange();
    }

    /** Map a click on rendered markdown to its source line. Paragraphs
     *  and headings carry data-line (exact); code blocks carry
     *  first/last (the click lands on the last content line). */
    function lineFromEvent(e: MouseEvent): number | null {
        const target = e.target as HTMLElement | null;
        const lineEl = target?.closest('[data-line], [data-first-line]') ?? null;
        if (!lineEl) return null;
        const exact = lineEl.getAttribute('data-line');
        if (exact !== null) return Number(exact);
        const last = lineEl.getAttribute('data-last-line');
        return last !== null ? Number(last) : null;
    }

    function handleIdleClick(e: MouseEvent): void {
        const line = lineFromEvent(e);
        if (line === null) {
            // Clicked the container padding: start at the top.
            startEdit(0);
            return;
        }
        startEdit(line);
    }

    /** Re-target the caret line from a click on rendered markdown WHILE
     *  EDITING. This must run on MOUSEDOWN with preventDefault: the
     *  default focus change would blur the textarea first, and the
     *  blur's fallback-to-idle would replace the very element being
     *  clicked before the click event ever fires (the line switch would
     *  silently no-op). preventDefault keeps the textarea focused, and
     *  the caret effect re-positions it. */
    function handleEditingMousedown(e: MouseEvent): void {
        const target = e.target as HTMLElement | null;
        // Native caret placement inside the raw line stays native.
        if (target?.closest('textarea') !== null) return;
        const line = lineFromEvent(e);
        if (line === null || line === caretLine) {
            e.preventDefault();
            return;
        }
        e.preventDefault();
        setCaret(line, (lines[line] ?? '').length);
    }

    /** Start editing at a line (used by parents that open the editor
     *  programmatically -- the day-note affordance jumps straight into
     *  the raw line instead of a click-inside click-inside). */
    export function startEditing(line = 0, col = 0): void {
        startEdit(line, col);
    }

    function handleRootKeydown(e: KeyboardEvent): void {
        // Idle: Enter or Space opens the first line for editing --
        // keyboard parity for the click-to-edit gesture.
        if (caretLine === null && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            startEdit(0);
        }
    }
</script>

<div
    class="live-markdown md-root"
    class:editing={caretLine !== null}
    role="textbox"
    aria-multiline="true"
    aria-label={ariaLabel}
    tabindex={caretLine === null ? 0 : -1}
    onkeydown={handleRootKeydown}
>
    {#if caretLine === null}
        <!-- Idle: everything rendered. data-line attrs stay on so the
             first click maps straight to the right source line. The
             keyboard path (Enter/Space) lives on the root textbox. -->
        <!-- svelte-ignore a11y_no_static_element_interactions,
             a11y_click_events_have_key_events -->
        <div class="md-idle" onclick={handleIdleClick}>
            {#if isEmpty}
                <span class="md-placeholder">{placeholder}</span>
            {:else}
                {@html idleHtml}
            {/if}
        </div>
    {:else}
        <!-- Editing: everything rendered except the caret's line, which
             shows raw syntax in the textarea between the fragments.
             Mousedown on rendered lines re-targets the caret (see
             handler); the textarea carries the keyboard. -->
        <!-- svelte-ignore a11y_no_static_element_interactions,
             a11y_no_noninteractive_element_interactions -->
        <div class="md-editing" onmousedown={handleEditingMousedown}>
            {@html beforeHtml}
            <textarea
                class="md-line-input"
                bind:this={textareaEl}
                bind:value={caretText}
                rows="1"
                spellcheck="true"
                aria-label={ariaLabel}
                oninput={handleInput}
                onkeydown={handleKeydown}
                onpaste={handlePaste}
                onblur={handleBlur}
            ></textarea>
            {@html afterHtml}
        </div>
    {/if}
</div>

<style>
    .live-markdown {
        cursor: text;
        outline: none;
    }

    .live-markdown:focus-visible {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
        border-radius: 4px;
    }

    /* The raw-syntax line: same metrics as the rendered text so the
       line does not jump when it switches modes. */
    .md-line-input {
        display: block;
        width: 100%;
        box-sizing: border-box;
        border: none;
        border-radius: 4px;
        padding: 0 2px;
        margin: 0;
        background: color-mix(in oklab, var(--color-accent) 6%, transparent);
        color: var(--color-text);
        font: inherit;
        line-height: inherit;
        resize: none;
        overflow: hidden;
        min-height: 1.55em;
    }

    .md-line-input:focus {
        outline: none;
        background: color-mix(in oklab, var(--color-accent) 10%, transparent);
    }

    .md-placeholder {
        color: var(--color-text-muted);
    }
</style>