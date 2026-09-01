import { describe, expect, test } from 'bun:test';
import { formatBinding, modifierLabel, SHORTCUT_SECTIONS, SHORTCUTS } from './keybindings';

/**
 * Invariants of the shortcut registry. The registry is the single source of
 * truth for the HelpModal table AND the hover tooltips — these tests are the
 * guard against the three ways it can silently drift:
 *   1. a shortcut exists but no help section lists it (undocumented feature)
 *   2. a section lists a shortcut twice (help table repeats a row)
 *   3. two actions claim the same keystroke (one shadowing the other)
 */

/** Keycap names that are not single printable characters. */
const NAMED_KEYS = new Set(['Enter', 'Esc', 'Space', '↓', '↑']);

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
                    // "{mod}", "{mod}+K", "{mod}+\\" are single tokens;
                    // everything else is one keycap or a named key.
                    const ok =
                        token === '{mod}' ||
                        /^\{mod\}\+.$/.test(token) ||
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
