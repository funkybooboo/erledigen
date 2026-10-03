/**
 * Command palette: command metadata + pure argument parsing.
 *
 * The SearchModal owns the thin dispatch (it has the stores); these
 * helpers stay pure so the matching/parsing rules are unit-tested the
 * same way the keybinding matcher is.
 */

import type { Task } from '@erledigen/shared';

export interface PaletteCommand {
    /** The word after "/" that invokes the command. */
    id: string;
    /** Rendered label ("/add"). */
    label: string;
    /** Shown in the command list. */
    description: string;
    /** Commands without arguments run immediately on Enter. */
    noArgs?: boolean;
}

/** Order = display order in the palette. Mirrors the roadmap's command
 *  table (plans/roadmap.md, v0.5.0). */
export const PALETTE_COMMANDS: PaletteCommand[] = [
    {
        id: 'add',
        label: '/add',
        description: 'Add a task (dates, #tags, and habit phrases are parsed)',
    },
    {
        id: 'complete',
        label: '/complete',
        description: 'Complete a task matching the text',
    },
    {
        id: 'delete',
        label: '/delete',
        description: 'Delete a task matching the text',
    },
    {
        id: 'move',
        label: '/move',
        description: 'Move a task to a date ("<text> to <date>")',
    },
    {
        id: 'go',
        label: '/go',
        description: 'Jump the day list to a date (e.g. /go next monday)',
    },
    {
        id: 'tag',
        label: '/tag',
        description: 'Add a tag to a task ("<text> with <tag>")',
    },
    {
        id: 'filter',
        label: '/filter',
        description: 'Filter the day list by a tag',
    },
    {
        id: 'clear',
        label: '/clear',
        description: 'Clear all active filters',
        noArgs: true,
    },
    {
        id: 'today',
        label: '/today',
        description: 'Jump the day list to today',
        noArgs: true,
    },
    {
        id: 'someday',
        label: '/someday',
        description: 'Move a task to Someday',
    },
    {
        id: 'project',
        label: '/project',
        description: 'Open the Projects modal',
        noArgs: true,
    },
    {
        id: 'habit',
        label: '/habit',
        description: 'Open the Habits modal',
        noArgs: true,
    },
    {
        id: 'settings',
        label: '/settings',
        description: 'Open Settings',
        noArgs: true,
    },
    {
        id: 'help',
        label: '/help',
        description: 'Open the keyboard shortcuts',
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
