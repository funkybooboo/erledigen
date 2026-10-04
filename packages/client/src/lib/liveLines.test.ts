import { describe, expect, test } from 'bun:test';
import {
    type CaretState,
    continueListMarker,
    mergeLineUp,
    pasteLines,
    splitLineAt,
    toLines,
} from './liveLines';

function state(lines: string[], caretLine: number, caretCol: number): CaretState {
    return { lines, caretLine, caretCol };
}

describe('splitLineAt (Enter)', () => {
    test('splits a plain line at the caret', () => {
        const result = splitLineAt(state(['hello world'], 0, 5));
        expect(result.lines).toEqual(['hello', ' world']);
        expect(result.caretLine).toBe(1);
        expect(result.caretCol).toBe(0);
    });

    test('continues a dash list when Enter ends the item', () => {
        const result = splitLineAt(state(['- buy milk'], 0, 10));
        expect(result.lines).toEqual(['- buy milk', '- ']);
        expect(result.caretCol).toBe(2);
    });

    test('increments ordered markers', () => {
        const result = splitLineAt(state(['3. third'], 0, 8));
        expect(result.lines).toEqual(['3. third', '4. ']);
    });

    test('a caret mid-line does not continue the list (plain split)', () => {
        const result = splitLineAt(state(['- buy milk'], 0, 4));
        expect(result.lines).toEqual(['- bu', 'y milk']);
    });

    test('Enter on a bare marker exits the list', () => {
        const result = splitLineAt(state(['- '], 0, 2));
        expect(result.lines).toEqual(['- ', '']);
    });

    test('nested markers keep their indent', () => {
        const result = splitLineAt(state(['  - nested'], 0, 10));
        expect(result.lines).toEqual(['  - nested', '  - ']);
    });
});

describe('mergeLineUp (Backspace at column 0)', () => {
    test('joins the caret line onto the previous one, caret at the seam', () => {
        const result = mergeLineUp(state(['one', 'two'], 1, 0));
        expect(result).not.toBeNull();
        expect(result?.lines).toEqual(['one' + 'two']);
        expect(result?.caretLine).toBe(0);
        expect(result?.caretCol).toBe(3);
    });

    test('returns null on the first line (nothing above)', () => {
        expect(mergeLineUp(state(['only'], 0, 0))).toBeNull();
    });
});

describe('continueListMarker', () => {
    test('dash, star, plus', () => {
        expect(continueListMarker('- x')).toBe('- ');
        expect(continueListMarker('* x')).toBe('* ');
        expect(continueListMarker('+ x')).toBe('+ ');
    });

    test('ordered markers increment with the same punctuation', () => {
        expect(continueListMarker('1. x')).toBe('2. ');
        expect(continueListMarker('9) x')).toBe('10) ');
    });

    test('non-list lines and empty items continue nothing', () => {
        expect(continueListMarker('plain text')).toBeNull();
        expect(continueListMarker('-')).toBeNull();
        expect(continueListMarker('- ')).toBeNull();
        expect(continueListMarker('1.')).toBeNull();
    });
});

describe('pasteLines / toLines', () => {
    test('multi-line paste splits on newlines', () => {
        expect(pasteLines('a\nb\nc')).toEqual(['a', 'b', 'c']);
        expect(pasteLines('a\r\nb')).toEqual(['a', 'b']);
    });

    test('toLines keeps an empty note as one empty line', () => {
        expect(toLines('')).toEqual(['']);
        expect(toLines('one')).toEqual(['one']);
    });
});
