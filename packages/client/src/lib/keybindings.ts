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
 * Binding string conventions:
 *   - each entry in `bindings` is one *alternate way* to trigger the action
 *     (rendered separated by "/")
 *   - within one binding, a space separates a keystroke *sequence*
 *     ("g t" means press g, then t)
 *   - the token "{mod}" is replaced at display time with the platform
 *     modifier key (Cmd on Apple platforms, Ctrl elsewhere)
 */

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
    /** Action description, shown in the help modal and in tooltips. */
    label: string;
}

export const SHORTCUTS: Record<ShortcutId, Shortcut> = {
    focusNext: { bindings: ['j', '\u2193'], label: 'Focus next task' },
    focusPrev: { bindings: ['k', '\u2191'], label: 'Focus previous task' },
    jumpNextSection: { bindings: ['J'], label: 'Jump to next day / group' },
    jumpPrevSection: { bindings: ['K'], label: 'Jump to previous day / group' },
    addTask: { bindings: ['n', 'a'], label: 'Add new task' },
    editTask: { bindings: ['Enter'], label: 'Edit focused task' },
    taskDetail: { bindings: ['e'], label: 'Task details' },
    toggleComplete: { bindings: ['Space'], label: 'Complete / uncomplete' },
    deleteTask: { bindings: ['d'], label: 'Delete task' },
    undo: { bindings: ['{mod}+Z'], label: 'Undo last action' },
    redo: { bindings: ['{mod}+Shift+Z'], label: 'Redo' },
    rescheduleTask: { bindings: ['r'], label: 'Reschedule task' },
    moveTask: { bindings: ['m'], label: 'Move task to another day' },
    editTags: { bindings: ['t'], label: 'Edit tags' },
    setP1: { bindings: ['1'], label: 'Set priority #p1' },
    setP2: { bindings: ['2'], label: 'Set priority #p2' },
    setP3: { bindings: ['3'], label: 'Set priority #p3' },
    clearPriority: { bindings: ['0'], label: 'Clear priority' },
    goToday: { bindings: ['g t'], label: 'Jump to today' },
    toggleSomedayPanel: { bindings: ['{mod}+\\'], label: 'Toggle Someday panel' },
    search: { bindings: ['{mod}+K', '/'], label: 'Search / command palette' },
    help: { bindings: ['?'], label: 'Keyboard shortcuts' },
    closeModal: { bindings: ['Esc'], label: 'Close' },
    openSummary: { bindings: ['g s'], label: 'Summary' },
    openProjects: { bindings: ['g p'], label: 'Projects' },
    openHabits: { bindings: ['g h'], label: 'Habits' },
    openCalendar: { bindings: ['g c'], label: 'Calendar' },
    openFilter: { bindings: ['g f'], label: 'Filter' },
    openTrash: { bindings: ['g x'], label: 'Trash' },
    openSettings: { bindings: ['g o'], label: 'Settings' },
    openTheme: { bindings: ['g a'], label: 'Theme' },
    openNotes: { bindings: ['g n'], label: 'Notes' },
};

/** Section layout for the help modal's shortcut table. */
export const SHORTCUT_SECTIONS: { title: string; ids: ShortcutId[] }[] = [
    {
        title: 'Navigation',
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
        title: 'Task Actions',
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
        title: 'Panels & Modals',
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
        clean[id as ShortcutId] = { label: SHORTCUTS[id as ShortcutId].label, bindings };
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
