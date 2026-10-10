/**
 * Command palette: command metadata + pure argument parsing.
 *
 * The SearchModal owns the thin dispatch (it has the stores); these
 * helpers stay pure so the matching/parsing rules are unit-tested the
 * same way the keybinding matcher is.
 */

import type { Task } from '@erledigen/shared';
import type { TranslationKey } from './i18n/locales';

export interface PaletteCommand {
    /** The word after "/" that invokes the command. */
    id: string;
    /** Rendered label ("/add") -- typed COMMAND SYNTAX, never
     *  localized (the input grammar stays English, ADR-023). */
    label: string;
    /** Locale key for the description shown in the command list. */
    descriptionKey: TranslationKey;
    /** Commands without arguments run immediately on Enter. */
    noArgs?: boolean;
}

/** Order = display order in the palette. Mirrors the roadmap's command
 *  table (plans/roadmap.md, v0.5.0). */
export const PALETTE_COMMANDS: PaletteCommand[] = [
    {
        id: 'add',
        label: '/add',
        descriptionKey: 'search.commands.add',
    },
    {
        id: 'complete',
        label: '/complete',
        descriptionKey: 'search.commands.complete',
    },
    {
        id: 'delete',
        label: '/delete',
        descriptionKey: 'search.commands.delete',
    },
    {
        id: 'move',
        label: '/move',
        descriptionKey: 'search.commands.move',
    },
    {
        id: 'go',
        label: '/go',
        descriptionKey: 'search.commands.go',
    },
    {
        id: 'tag',
        label: '/tag',
        descriptionKey: 'search.commands.tag',
    },
    {
        id: 'filter',
        label: '/filter',
        descriptionKey: 'search.commands.filter',
    },
    {
        id: 'clear',
        label: '/clear',
        descriptionKey: 'search.commands.clear',
        noArgs: true,
    },
    {
        id: 'today',
        label: '/today',
        descriptionKey: 'search.commands.today',
        noArgs: true,
    },
    {
        id: 'someday',
        label: '/someday',
        descriptionKey: 'search.commands.someday',
    },
    {
        id: 'project',
        label: '/project',
        descriptionKey: 'search.commands.project',
        noArgs: true,
    },
    {
        id: 'habit',
        label: '/habit',
        descriptionKey: 'search.commands.habit',
        noArgs: true,
    },
    {
        id: 'settings',
        label: '/settings',
        descriptionKey: 'search.commands.settings',
        noArgs: true,
    },
    {
        id: 'help',
        label: '/help',
        descriptionKey: 'search.commands.help',
        noArgs: true,
    },
];

/**
 * Find the first task whose text contains the query (case-insensitive).
 * Incomplete tasks win over completed ones -- "complete buy milk" should
 * never silently pick an already-done task with similar text.
 */
export function findTaskByText(tasks: Task[], query: string): Task | null {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return (
        tasks.find(t => !t.completed && t.text.toLowerCase().includes(q)) ??
        tasks.find(t => t.text.toLowerCase().includes(q)) ??
        null
    );
}

/** Split "<left><separator><right>" on the LAST occurrence of the
 *  separator, so the task text itself may contain the separator word
 *  ("reply to mom" + "to friday"). Returns null when absent. */
export function splitOnLast(
    args: string,
    separator: string,
): { left: string; right: string } | null {
    const index = args.lastIndexOf(separator);
    if (index === -1) return null;
    const left = args.slice(0, index).trim();
    const right = args.slice(index + separator.length).trim();
    if (!left || !right) return null;
    return { left, right };
}

/** "/move <text> to <date>" argument pair; null when the " to " part is
 *  missing or one side is empty. */
export function parseMoveArgs(args: string): { text: string; date: string } | null {
    const parts = splitOnLast(args, ' to ');
    return parts ? { text: parts.left, date: parts.right } : null;
}

/** "/tag <text> with <tag>" argument pair; null when the " with " part
 *  is missing or one side is empty. */
export function parseTagArgs(args: string): { text: string; tag: string } | null {
    const parts = splitOnLast(args, ' with ');
    return parts ? { text: parts.left, tag: parts.right } : null;
}

/** Normalize a typed tag for /filter and /tag: trim, strip a leading "#",
 *  lowercase. Empty when nothing remains. */
export function normalizeTagInput(input: string): string {
    return input.trim().replace(/^#/, '').toLowerCase();
}
