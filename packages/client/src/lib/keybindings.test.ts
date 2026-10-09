import { describe, expect, test } from 'bun:test';
import {
    applyShortcutOverrides,
    bindingConflicts,
    formatBinding,
    isValidBinding,
    modifierLabel,
    SHORTCUT_SECTIONS,
    SHORTCUTS,
    sanitizeShortcutOverrides,
} from './keybindings';

/**
 * Invariants of the shortcut registry. The registry is the single source of
 * truth for the HelpModal table AND the hover tooltips -- these tests are the
 * guard against the three ways it can silently drift:
 *   1. a shortcut exists but no help section lists it (undocumented feature)
 *   2. a section lists a shortcut twice (help table repeats a row)
 *   3. two actions claim the same keystroke (one shadowing the other)
 */

/** Keycap names that are not single printable characters. */
const NAMED_KEYS = new Set(['Enter', 'Esc', 'Space', '\u2193', '\u2191']);

describe('SHORTCUTS registry', () => {
    test('every shortcut is listed in exactly one help section', () => {
        const listed = SHORTCUT_SECTIONS.flatMap(s => s.ids);
        const registryIds = Object.keys(SHORTCUTS);

        // No shortcut is missing from the help modal.
        for (const id of registryIds) {
            expect(listed.filter(x => x === id)).toHaveLength(1);
        }
        // And no section references a shortcut that no longer exists.
        expect(listed.every(id => registryIds.includes(id))).toBe(true);
    });

    test('every shortcut documents at least one binding', () => {
        for (const [id, shortcut] of Object.entries(SHORTCUTS)) {
            expect(shortcut.bindings.length, id).toBeGreaterThan(0);
            expect(shortcut.label.length, id).toBeGreaterThan(0);
        }
    });

    test('bindings use only the documented token grammar', () => {
        for (const [id, shortcut] of Object.entries(SHORTCUTS)) {
            for (const binding of shortcut.bindings) {
                expect(binding.length, `${id}: empty binding`).toBeGreaterThan(0);
                for (const token of binding.split(' ')) {
                    // "{mod}", "{mod}+K", "{mod}+\\", "{mod}+Shift+Z" are
                    // single tokens; everything else is one keycap or a
                    // named key.
                    const ok =
                        token === '{mod}' ||
                        /^\{mod\}\+.$/.test(token) ||
                        token === '{mod}+Shift+Z' ||
                        token.length === 1 ||
                        NAMED_KEYS.has(token);
                    expect(ok, `${id}: unexpected token "${token}" in "${binding}"`).toBe(true);
                }
            }
        }
    });

    test('no two actions claim the same single-key binding', () => {
        const claims = new Map<string, string>();
        for (const [id, shortcut] of Object.entries(SHORTCUTS)) {
            // Modifier bindings (Ctrl+K) are scoped by modifier and can't
            // collide with plain keys; only bare keys are global.
            const bareKeys = shortcut.bindings.filter(b => !b.includes('{mod}'));
            for (const key of bareKeys) {
                const owner = claims.get(key);
                expect(owner, `"${key}" is bound to both ${owner} and ${id}`).toBeUndefined();
                claims.set(key, id);
            }
        }
    });
});

describe('formatBinding', () => {
    // Bun's test runtime reports a non-Apple user agent, so the non-Apple
    // branch of the platform check is what these assertions exercise.
    test('expands {mod} to the platform modifier label', () => {
        // Non-Apple keeps the "+" separator: "{mod}+K" -> "Ctrl+K".
        expect(formatBinding('{mod}+K')).toBe(`${modifierLabel()}+K`);
        expect(formatBinding('{mod}+\\')).toBe(`${modifierLabel()}+\\`);
    });

    test('leaves bindings without {mod} untouched', () => {
        expect(formatBinding('g t')).toBe('g t');
        expect(formatBinding('j')).toBe('j');
    });
});

describe('shortcut remapping helpers (USE-7)', () => {
    test('isValidBinding accepts the documented grammar', () => {
        expect(isValidBinding('j')).toBe(true);
        expect(isValidBinding('J')).toBe(true);
        expect(isValidBinding('g t')).toBe(true);
        expect(isValidBinding('{mod}+K')).toBe(true);
        expect(isValidBinding('{mod}+Shift+Z')).toBe(true);
        expect(isValidBinding('Space')).toBe(true);
        expect(isValidBinding('ArrowDown')).toBe(true);

        expect(isValidBinding('')).toBe(false);
        expect(isValidBinding('g t x')).toBe(false); // 3-token sequence
        expect(isValidBinding('{mod} g')).toBe(false); // modifier inside a sequence
        expect(isValidBinding('Ctrl+K')).toBe(false); // literal Ctrl, not {mod}
        expect(isValidBinding('g  t')).toBe(false); // empty token from double space
    });

    test('sanitizeShortcutOverrides drops unknown ids and invalid bindings', () => {
        const clean = sanitizeShortcutOverrides({
            openTrash: ['g z'],
            notARealId: ['j'],
            focusNext: [''],
            focusPrev: [],
            openSettings: ['g o'],
        });
        expect(Object.keys(clean).sort()).toEqual(['openSettings', 'openTrash']);
        expect(clean.openTrash?.bindings).toEqual(['g z']);
        expect(clean.openSettings?.bindings).toEqual(['g o']);
        // null/undefined maps sanitize to nothing.
        expect(sanitizeShortcutOverrides(null)).toEqual({});
        expect(sanitizeShortcutOverrides(undefined)).toEqual({});
    });

    test('applyShortcutOverrides overlays sanitized overrides on the defaults', () => {
        const resolved = applyShortcutOverrides(SHORTCUTS, {
            openTrash: { label: 'Trash', bindings: ['g', 'z'] },
        });
        expect(resolved.openTrash.bindings).toEqual(['g', 'z']);
        // Untouched entries keep the defaults (identity for the rest).
        expect(resolved.openSettings.bindings).toEqual(SHORTCUTS.openSettings.bindings);
    });

    test('bindingConflicts reports exact and sequence-prefix clashes', () => {
        const resolved = applyShortcutOverrides(SHORTCUTS, {
            openTrash: { label: 'Trash', bindings: ['j'] }, // same as focusNext
        });
        expect(bindingConflicts(resolved, 'openTrash')).toContain('focusNext');

        // A plain 'g' would swallow every chord's first key.
        const withPlainG = applyShortcutOverrides(SHORTCUTS, {
            openTrash: { label: 'Trash', bindings: ['g'] },
        });
        expect(bindingConflicts(withPlainG, 'openTrash')).toContain('goToday');

        // {mod} chords are scoped by modifier: {mod}+P clashes with nothing
        // (undo owns {mod}+Z; a plain p is not the same key).
        const withChord = applyShortcutOverrides(SHORTCUTS, {
            openTrash: { label: 'Trash', bindings: ['{mod}+P'] },
        });
        expect(bindingConflicts(withChord, 'openTrash')).toEqual([]);

        // Default registry has no conflicts (the no-shadowing invariant).
        for (const id of Object.keys(SHORTCUTS)) {
            expect(bindingConflicts(SHORTCUTS, id as keyof typeof SHORTCUTS)).toEqual([]);
        }
    });
});
