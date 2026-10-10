/**
 * Single source of truth for every keyboard shortcut in the app.
 *
 * The same registry drives all three surfaces, so they can never drift
 * apart:
 *   - the HelpModal shortcut table (HelpModal.svelte)
 *   - the hover tooltips (`use:tooltip` from lib/tooltip.ts)
 *   - the dispatch itself: lib/keyboard.ts matches KeyboardEvents
 *     against these binding strings, and lib/keybindingActions.ts supplies
 *     the handler for every id (TypeScript enforces the pairing)
 *
 * Labels are locale keys (v0.13.0): the registry carries stable ids and
 * every render site translates labelKey through the i18n store.

 * Binding string conventions:
 *   - each entry in `bindings` is one *alternate way* to trigger the action
 *     (rendered separated by "/")
 *   - within one binding, a space separates a keystroke *sequence*
 *     ("g t" means press g, then t)
 *   - the token "{mod}" is replaced at display time with the platform
 *     modifier key (Cmd on Apple platforms, Ctrl elsewhere)
 */

import type { TranslationKey } from './i18n/locales';

export type ShortcutId =
    | 'focusNext'
    | 'focusPrev'
    | 'jumpNextSection'
    | 'jumpPrevSection'
    | 'addTask'
    | 'editTask'
    | 'taskDetail'
    | 'toggleComplete'
    | 'deleteTask'
    | 'undo'
    | 'redo'
    | 'rescheduleTask'
    | 'moveTask'
    | 'editTags'
    | 'setP1'
    | 'setP2'
    | 'setP3'
    | 'clearPriority'
    | 'goToday'
    | 'toggleSomedayPanel'
    | 'search'
    | 'help'
    | 'closeModal'
    | 'openSummary'
    | 'openProjects'
    | 'openHabits'
    | 'openCalendar'
    | 'openFilter'
    | 'openTrash'
    | 'openSettings'
    | 'openTheme'
    | 'openNotes';

export interface Shortcut {
    /** One string per alternate way to trigger the action. Each is a
     *  space-separated keystroke sequence ("g t", "{mod}K", "j"). */
    bindings: string[];
    /** The action's label KEY (i18n, v0.13.0): 'shortcut.<id>' in the
     *  locale file -- every render site (help table, tooltips, the
     *  Settings remap rows) translates it through the i18n store. */
    labelKey: TranslationKey;
}

export const SHORTCUTS: Record<ShortcutId, Shortcut> = {
    focusNext: { bindings: ['j', '\u2193'], labelKey: 'shortcut.focusNext' },
    focusPrev: { bindings: ['k', '\u2191'], labelKey: 'shortcut.focusPrev' },
    jumpNextSection: { bindings: ['J'], labelKey: 'shortcut.jumpNextSection' },
    jumpPrevSection: { bindings: ['K'], labelKey: 'shortcut.jumpPrevSection' },
    addTask: { bindings: ['n', 'a'], labelKey: 'shortcut.addTask' },
    editTask: { bindings: ['Enter'], labelKey: 'shortcut.editTask' },
    taskDetail: { bindings: ['e'], labelKey: 'shortcut.taskDetail' },
    toggleComplete: { bindings: ['Space'], labelKey: 'shortcut.toggleComplete' },
    deleteTask: { bindings: ['d'], labelKey: 'shortcut.deleteTask' },
    undo: { bindings: ['{mod}+Z'], labelKey: 'shortcut.undo' },
    redo: { bindings: ['{mod}+Shift+Z'], labelKey: 'shortcut.redo' },
    rescheduleTask: { bindings: ['r'], labelKey: 'shortcut.rescheduleTask' },
    moveTask: { bindings: ['m'], labelKey: 'shortcut.moveTask' },
    editTags: { bindings: ['t'], labelKey: 'shortcut.editTags' },
    setP1: { bindings: ['1'], labelKey: 'shortcut.setP1' },
    setP2: { bindings: ['2'], labelKey: 'shortcut.setP2' },
    setP3: { bindings: ['3'], labelKey: 'shortcut.setP3' },
    clearPriority: { bindings: ['0'], labelKey: 'shortcut.clearPriority' },
    goToday: { bindings: ['g t'], labelKey: 'shortcut.goToday' },
    toggleSomedayPanel: { bindings: ['{mod}+\\'], labelKey: 'shortcut.toggleSomedayPanel' },
    search: { bindings: ['{mod}+K', '/'], labelKey: 'shortcut.search' },
    help: { bindings: ['?'], labelKey: 'shortcut.help' },
    closeModal: { bindings: ['Esc'], labelKey: 'shortcut.closeModal' },
    openSummary: { bindings: ['g s'], labelKey: 'shortcut.openSummary' },
    openProjects: { bindings: ['g p'], labelKey: 'shortcut.openProjects' },
    openHabits: { bindings: ['g h'], labelKey: 'shortcut.openHabits' },
    openCalendar: { bindings: ['g c'], labelKey: 'shortcut.openCalendar' },
    openFilter: { bindings: ['g f'], labelKey: 'shortcut.openFilter' },
    openTrash: { bindings: ['g x'], labelKey: 'shortcut.openTrash' },
    openSettings: { bindings: ['g o'], labelKey: 'shortcut.openSettings' },
    openTheme: { bindings: ['g a'], labelKey: 'shortcut.openTheme' },
    openNotes: { bindings: ['g n'], labelKey: 'shortcut.openNotes' },
};

/** Section layout for the help modal's shortcut table. Titles are
 *  i18n keys (shortcutSection.*), rendered through the i18n store. */
export const SHORTCUT_SECTIONS: { titleKey: TranslationKey; ids: ShortcutId[] }[] = [
    {
        titleKey: 'shortcutSection.navigation',
        ids: [
            'focusNext',
            'focusPrev',
            'jumpNextSection',
            'jumpPrevSection',
            'goToday',
            'toggleSomedayPanel',
        ],
    },
    {
        titleKey: 'shortcutSection.taskActions',
        ids: [
            'addTask',
            'editTask',
            'taskDetail',
            'toggleComplete',
            'deleteTask',
            'undo',
            'redo',
            'rescheduleTask',
            'moveTask',
            'editTags',
            'setP1',
            'setP2',
            'setP3',
            'clearPriority',
        ],
    },
    {
        titleKey: 'shortcutSection.panelsModals',
        ids: [
            'search',
            'openSummary',
            'openProjects',
            'openHabits',
            'openCalendar',
            'openNotes',
            'openFilter',
            'openTrash',
            'openSettings',
            'openTheme',
            'help',
            'closeModal',
        ],
    },
];

const IS_APPLE =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

// ------------------------------------------------------------------
// Shortcut remapping (USE-7). Pure helpers -- no store imports: the
// keyboard unit tests run against this module bare.
// ------------------------------------------------------------------

/** The full registry shape (defaults and overrides both). */
export type ShortcutRegistry = Record<ShortcutId, Shortcut>;

/** Keycap names that are not single printable characters. This is the
 *  VALID set for remapping (slightly wider than the registry's current
 *  contents so users can bind keys the defaults do not use). */
const NAMED_KEYS = new Set([
    'Space',
    'Enter',
    'Escape',
    'Esc',
    'ArrowDown',
    '\u2193',
    'ArrowUp',
    '\u2191',
    'ArrowLeft',
    'ArrowRight',
    'Tab',
    'Delete',
    'Backspace',
    'Home',
    'End',
]);

/** One binding string in the documented grammar: 1-2 keystroke tokens,
 *  each a printable character, a named key, or a {mod} chord
 *  ('{mod}+K', '{mod}+Shift+Z'). */
export function isValidBinding(binding: string): boolean {
    if (binding.length === 0) return false;
    const tokens = binding.split(' ');
    if (tokens.length > 2) return false;
    for (const token of tokens) {
        const ok =
            token === '{mod}' ||
            /^\{mod\}\+.$/.test(token) ||
            token === '{mod}+Shift+Z' ||
            NAMED_KEYS.has(token) ||
            /^\S$/.test(token);
        if (!ok) return false;
    }
    return tokens.length !== 2 || tokens.every(t => !t.includes('{mod}'));
}

/** The overrides a persisted map can safely contribute: unknown ids and
 *  invalid/empty binding lists are dropped (they can only come from a
 *  hand-edited database or a future registry change -- never from the
 *  UI, which validates before saving). */
export function sanitizeShortcutOverrides(
    overrides: Record<string, string[]> | null | undefined,
): Partial<ShortcutRegistry> {
    const clean: Partial<ShortcutRegistry> = {};
    if (overrides === null || overrides === undefined) return clean;
    for (const [id, bindings] of Object.entries(overrides)) {
        if (!(id in SHORTCUTS)) continue;
        if (!Array.isArray(bindings) || bindings.length === 0) continue;
        if (!bindings.every(binding => isValidBinding(binding))) continue;
        clean[id as ShortcutId] = { labelKey: SHORTCUTS[id as ShortcutId].labelKey, bindings };
    }
    return clean;
}

/** Merge sanitized overrides over the defaults (later keys win).
 *  applyShortcutOverrides(SHORTCUTS, overrides) is the live registry. */
export function applyShortcutOverrides(
    base: ShortcutRegistry,
    overrides: Partial<ShortcutRegistry>,
): ShortcutRegistry {
    return { ...base, ...overrides };
}

/** Actions whose bindings share a keystroke with `id` (excluding id
 *  itself). Bare keys are global; {mod} chords are scoped by modifier;
 *  sequence tokens are compared pairwise, and a single key that equals
 *  another binding's sequence PREFIX also clashes (the plain key would
 *  swallow the chord's first press, killing the sequence). Sorted by
 *  registry order. */
export function bindingConflicts(registry: ShortcutRegistry, id: ShortcutId): ShortcutId[] {
    const mine = registry[id].bindings;
    const conflicts: ShortcutId[] = [];
    for (const [otherId, shortcut] of Object.entries(registry)) {
        if (otherId === id) continue;
        const other = shortcut.bindings;
        const clash = mine.some(binding =>
            other.some(candidate => {
                if (binding.includes('{mod}') !== candidate.includes('{mod}')) return false;
                if (binding === candidate) return true;
                // Sequence-prefix capture: 'g' clashes with 'g x'.
                const bTokens = binding.split(' ');
                const cTokens = candidate.split(' ');
                if (bTokens.length === 1 && cTokens.length === 2 && bTokens[0] === cTokens[0]) {
                    return true;
                }
                return cTokens.length === 1 && bTokens.length === 2 && cTokens[0] === bTokens[0];
            }),
        );
        if (clash) conflicts.push(otherId as ShortcutId);
    }
    return conflicts;
}

/** Platform modifier label: the Command symbol on Apple, "Ctrl" elsewhere. */
export function modifierLabel(): string {
    return IS_APPLE ? '\u2318' : 'Ctrl';
}

/** Expand a binding's "{mod}" token into the platform modifier label.
 *  On Apple platforms "Cmd+" collapses to the bare symbol ("\u2318K");
 *  elsewhere it stays "Ctrl+K". */
export function formatBinding(binding: string): string {
    if (IS_APPLE) {
        return binding.replaceAll('{mod}+', '\u2318').replaceAll('{mod}', '\u2318');
    }
    return binding.replaceAll('{mod}', 'Ctrl');
}
