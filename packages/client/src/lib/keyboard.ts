/**
 * Table-driven dispatch for the shortcut registry (lib/keybindings.ts).
 *
 * The matcher resolves KeyboardEvents to ShortcutIds purely from the
 * registry's binding strings -- no keystroke is hand-wired, so a binding
 * that exists in the registry can fire by construction, and a keystroke
 * the registry does not list can never fire.
 * keybindingActions.ts supplies the Record<ShortcutId, KeyboardAction>
 * the ids resolve to; TypeScript rejects that record when a shortcut is
 * added without an action, which closes the registry/handler drift loop.
 *
 * This module is pure (no stores, no DOM) so the matcher is unit-tested
 * directly; the layout-level gates (typing targets, open overlays,
 * native Space/Enter activation of focused controls) live in
 * keybindingActions.ts where the DOM and stores are reachable.
 */

import type { ShortcutId } from './keybindings';
import { SHORTCUTS } from './keybindings';

/** A KeyboardEvent reduced to what binding matching needs. */
export interface KeybindingEvent {
    key: string;
    ctrl: boolean;
    meta: boolean;
    alt: boolean;
    shift: boolean;
}

export type MatchResult =
    | { status: 'action'; id: ShortcutId }
    | { status: 'sequence-start' }
    | { status: 'none' };

/** Chords ("g t") expire after this long -- a lone prefix key must never
 *  swallow a later, unrelated keypress. */
export const SEQUENCE_TIMEOUT_MS = 800;

/** Map both sides to canonical KeyboardEvent.key names: registry display
 *  tokens ('Space', 'Esc', the arrow glyphs) and raw event keys (' ').
 *  Everything else passes through unchanged. */
const CANONICAL_KEYS: Record<string, string> = {
    ' ': 'Space',
    '\u2193': 'ArrowDown',
    '\u2191': 'ArrowUp',
    Esc: 'Escape',
};

export function canonicalKey(token: string): string {
    return CANONICAL_KEYS[token] ?? token;
}

type ScheduleFn = (fn: () => void, ms: number) => unknown;
type CancelFn = (handle: unknown) => void;

const defaultSchedule: ScheduleFn = (fn, ms) => setTimeout(fn, ms);
const defaultCancel: CancelFn = handle => clearTimeout(handle as ReturnType<typeof setTimeout>);

/** A parsed registry binding. */
interface ParsedBinding {
    id: ShortcutId;
    /** Binding tokens; one token = one keystroke, several = a sequence. */
    tokens: string[];
    /** '{mod}+X' modifier chord. */
    modifier: boolean;
}

function parseBindings(shortcuts: typeof SHORTCUTS): ParsedBinding[] {
    const parsed: ParsedBinding[] = [];
    for (const [id, shortcut] of Object.entries(shortcuts)) {
        for (const binding of shortcut.bindings) {
            const tokens = binding.split(' ');
            parsed.push({
                // Object.entries widens Record<ShortcutId, _> keys to
                // string; SHORTCUTS' explicit Record<ShortcutId, Shortcut>
                // typing makes the cast safe (no runtime behavior change).
                id: id as ShortcutId,
                tokens,
                modifier: tokens.length === 1 && tokens[0].includes('{mod}'),
            });
        }
    }
    return parsed;
}

export class KeybindingMatcher {
    /** Plain keystrokes, canonical key -> action. */
    readonly #plain = new Map<string, ShortcutId>();
    /** Modifier chords, lowercase key ('k' from '{mod}+K') -> action. */
    readonly #modifiers = new Map<string, ShortcutId>();
    /** Sequence bindings keyed by their canonical token path ('g t'). */
    readonly #sequences = new Map<string, ShortcutId>();
    /** First tokens of sequences ('g') -- the keys that arm a chord. */
    readonly #sequencePrefixes = new Set<string>();

    #pendingPrefix: string | null = null;
    #expiryTimer: unknown = null;
    readonly #schedule: ScheduleFn;
    readonly #cancelTimer: CancelFn;

    constructor(
        shortcuts: typeof SHORTCUTS = SHORTCUTS,
        timer: { setTimeout?: ScheduleFn; clearTimeout?: CancelFn } = {},
    ) {
        this.#schedule = timer.setTimeout ?? defaultSchedule;
        this.#cancelTimer = timer.clearTimeout ?? defaultCancel;
        for (const binding of parseBindings(shortcuts)) {
            const [first] = binding.tokens;
            if (first === undefined) continue;
            if (binding.modifier) {
                // '{mod}+K' -> the bare modifier key, lowercased.
                this.#modifiers.set(first.slice('{mod}+'.length).toLowerCase(), binding.id);
            } else if (binding.tokens.length === 1) {
                this.#plain.set(canonicalKey(first), binding.id);
            } else {
                this.#sequences.set(
                    [canonicalKey(first), ...binding.tokens.slice(1)].join(' '),
                    binding.id,
                );
                this.#sequencePrefixes.add(canonicalKey(first));
            }
        }
    }

    /**
     * Resolve one keydown. Modifier chords and plain keystrokes return
     * 'action'; the first key of a sequence returns 'sequence-start' (the
     * caller should swallow it); a sequence's second key returns 'action'
     * or 'none', consuming the pending sequence either way.
     */
    feed(event: KeybindingEvent): MatchResult {
        // Modifier chords first: they are matched in contexts where plain
        // keys are gated off (e.g. while typing).
        if (event.ctrl || event.meta) {
            this.cancel();
            if (event.alt || event.shift) return { status: 'none' };
            const id = this.#modifiers.get(event.key.toLowerCase());
            return id ? { status: 'action', id } : { status: 'none' };
        }
        if (event.alt) {
            this.cancel();
            return { status: 'none' };
        }

        const key = canonicalKey(event.key);

        // A pending sequence consumes the next plain key, matched or not.
        if (this.#pendingPrefix !== null) {
            const prefix = this.#pendingPrefix;
            this.cancel();
            const id = this.#sequences.get(`${prefix} ${key.toLowerCase()}`);
            return id ? { status: 'action', id } : { status: 'none' };
        }

        const plain = this.#plain.get(key);
        if (plain) return { status: 'action', id: plain };

        if (this.#sequencePrefixes.has(key)) {
            this.#armSequence(key);
            return { status: 'sequence-start' };
        }
        return { status: 'none' };
    }

    /** Drop any pending sequence (overlay opened, typing started, ...). */
    cancel(): void {
        this.#pendingPrefix = null;
        if (this.#expiryTimer !== null) {
            this.#cancelTimer(this.#expiryTimer);
            this.#expiryTimer = null;
        }
    }

    #armSequence(prefix: string): void {
        this.#pendingPrefix = prefix;
        if (this.#expiryTimer !== null) this.#cancelTimer(this.#expiryTimer);
        this.#expiryTimer = this.#schedule(() => {
            this.#pendingPrefix = null;
            this.#expiryTimer = null;
        }, SEQUENCE_TIMEOUT_MS);
    }
}
