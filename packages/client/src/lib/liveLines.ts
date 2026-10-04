/**
 * Pure line operations for the live markdown editor
 * (LiveMarkdownEditor.svelte, v0.10.0).
 *
 * The editor holds the note as `lines: string[]` plus a caret position
 * (`caretLine`, `caretCol`). These helpers implement every structural
 * edit as a pure function so the keyboard semantics are unit-testable
 * without a DOM -- the component only wires events to them.
 */

export interface CaretState {
    lines: string[];
    /** Which line holds the caret (raw-syntax textarea). */
    caretLine: number;
    /** Character offset within that line. */
    caretCol: number;
}

/** Split one line at the caret: Enter. The tail becomes a new line; a
 *  caret at the very end of a list item continues the list marker. */
export function splitLineAt(state: CaretState): CaretState {
    const { lines, caretLine, caretCol } = state;
    const current = lines[caretLine] ?? '';
    const head = current.slice(0, caretCol);
    const tail = current.slice(caretCol);

    let newLine = tail;
    let newCol = 0;
    // Enter at the end of a list item continues the list (Obsidian
    // behavior): "- foo" + Enter -> "- ", "3. foo" + Enter -> "4. ".
    // The item's indentation carries over so nested lists stay nested.
    if (tail === '') {
        const marker = continueListMarker(head);
        if (marker !== null) {
            newLine = marker;
            newCol = marker.length;
        }
    }

    const next = lines.slice();
    next.splice(caretLine, 1, head, newLine);
    return { lines: next, caretLine: caretLine + 1, caretCol: newCol };
}

/** Merge the caret line into the one above: Backspace at column 0.
 *  Returns null when there is no line above (nothing to merge). */
export function mergeLineUp(state: CaretState): CaretState | null {
    const { lines, caretLine } = state;
    if (caretLine === 0) return null;
    const previous = lines[caretLine - 1] ?? '';
    const current = lines[caretLine] ?? '';
    const merged = previous + current;
    const next = lines.slice();
    next.splice(caretLine - 1, 2, merged);
    return { lines: next, caretLine: caretLine - 1, caretCol: previous.length };
}

/** The marker a new line continues with when Enter ends a list item:
 *  "- " / "* " / "+ " as-is, ordered markers incremented. Null when the
 *  line is not a list item (or the item text is empty -- Enter on a
 *  bare marker exits the list instead of stacking markers). */
export function continueListMarker(line: string): string | null {
    const match = /^(\s*)([-*+]|\d{1,9}[.)])(?:\s+(.*))?$/.exec(line);
    if (!match) return null;
    // Enter on a bare "- " marker exits the list (empty item = done).
    if ((match[3] ?? '').trim() === '') return null;
    const marker = match[2] ?? '-';
    const indent = match[1] ?? '';
    const ordered = /^(\d{1,9})([.)])$/.exec(marker);
    if (ordered) {
        const next = Number.parseInt(ordered[1] ?? '1', 10) + 1;
        return `${indent}${next}${ordered[2] ?? '.'} `;
    }
    return `${indent}${marker} `;
}

/** Split pasted text into lines (CRLF normalized) -- a multi-line paste
 *  becomes multiple editor lines. */
export function pasteLines(text: string): string[] {
    return text.replace(/\r\n?/g, '\n').split('\n');
}

/** Normalize any note text into editor lines (empty note = one empty
 *  line, so there is always a caret home). */
export function toLines(value: string): string[] {
    const split = value.replace(/\r\n?/g, '\n').split('\n');
    return split;
}
