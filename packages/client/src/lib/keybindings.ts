/**
 * Single source of truth for every keyboard shortcut in the app.
 *
 * The same registry drives both user-facing surfaces, so they can never
 * drift apart:
 *   - the HelpModal shortcut table (HelpModal.svelte)
 *   - the hover tooltips (`use:tooltip` from lib/tooltip.ts)
 *
 * The keydown handlers in routes/+layout.svelte implement these bindings;
 * if you add or change a binding here, update the handler (and vice versa).
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
    | 'addTask'
    | 'editTask'
    | 'taskDetail'
    | 'toggleComplete'
    | 'deleteTask'
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
    | 'openSettings';

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
    addTask: { bindings: ['n', 'a'], label: 'Add new task' },
    editTask: { bindings: ['Enter'], label: 'Edit focused task' },
    taskDetail: { bindings: ['e'], label: 'Task details' },
    toggleComplete: { bindings: ['Space'], label: 'Complete / uncomplete' },
    deleteTask: { bindings: ['d'], label: 'Delete task' },
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
};

/** Section layout for the help modal's shortcut table. */
export const SHORTCUT_SECTIONS: { title: string; ids: ShortcutId[] }[] = [
    {
        title: 'Navigation',
        ids: ['focusNext', 'focusPrev', 'goToday', 'toggleSomedayPanel'],
    },
    {
        title: 'Task Actions',
        ids: [
            'addTask',
            'editTask',
            'taskDetail',
            'toggleComplete',
            'deleteTask',
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
            'openFilter',
            'openTrash',
            'openSettings',
            'help',
            'closeModal',
        ],
    },
];

const IS_APPLE =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

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
