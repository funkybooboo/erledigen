import { describe, expect, it } from 'bun:test';
import { SHORTCUTS, type ShortcutId } from './keybindings';
import { canonicalKey, type KeybindingEvent, KeybindingMatcher } from './keyboard';

/** Synthetic plain keystroke. */
function key(k: string, mods: Partial<KeybindingEvent> = {}): KeybindingEvent {
    return { key: k, ctrl: false, meta: false, alt: false, shift: false, ...mods };
}

describe('KeybindingMatcher', () => {
    it('resolves every registry binding from synthetic events', () => {
        // THE drift guard: every binding string in the registry must
        // resolve through the matcher. A registry entry that no
        // keystroke sequence can reach (typo'd token, unmapped display
        // glyph) fails here -- before it can ship as a dead shortcut.
        for (const [id, shortcut] of Object.entries(SHORTCUTS)) {
            for (const binding of shortcut.bindings) {
                const matcher = new KeybindingMatcher();
                const tokens = binding.split(' ');
                let result: ReturnType<KeybindingMatcher['feed']> | undefined;
                if (tokens[0]?.includes('{mod}')) {
                    const chord = tokens[0].slice('{mod}+'.length);
                    result = matcher.feed(key(chord, { ctrl: true }));
                } else {
                    result = matcher.feed(key(canonicalKey(tokens[0] ?? '')));
                    for (const next of tokens.slice(1)) {
                        result = matcher.feed(key(canonicalKey(next)));
                    }
                }
                expect(result, `${id}: binding "${binding}" did not resolve`).toEqual({
                    status: 'action',
                    id: id as ShortcutId,
                });
            }
        }
    });

    it('meta matches modifier chords like ctrl does', () => {
        const matcher = new KeybindingMatcher();
        expect(matcher.feed(key('k', { meta: true }))).toEqual({
            status: 'action',
            id: 'search',
        });
    });

    it('rejects modifier chords with alt or shift held', () => {
        const matcher = new KeybindingMatcher();
        expect(matcher.feed(key('k', { ctrl: true, alt: true }))).toEqual({ status: 'none' });
        expect(matcher.feed(key('k', { ctrl: true, shift: true }))).toEqual({ status: 'none' });
    });

    it('plain keys require no modifiers', () => {
        const matcher = new KeybindingMatcher();
        expect(matcher.feed(key('j', { ctrl: true }))).toEqual({ status: 'none' });
        expect(matcher.feed(key('j', { alt: true }))).toEqual({ status: 'none' });
        // Shift is allowed: '?' is shift+/ and must keep working.
        expect(matcher.feed(key('?', { shift: true }))).toEqual({
            status: 'action',
            id: 'help',
        });
    });

    it("maps the event's space key onto the Space binding", () => {
        const matcher = new KeybindingMatcher();
        expect(matcher.feed(key(' '))).toEqual({
            status: 'action',
            id: 'toggleComplete',
        });
    });

    it('completes sequences case-insensitively on the second key', () => {
        const matcher = new KeybindingMatcher();
        expect(matcher.feed(key('g'))).toEqual({ status: 'sequence-start' });
        expect(matcher.feed(key('T'))).toEqual({ status: 'action', id: 'goToday' });
    });

    it('an unrelated second key cancels the sequence', () => {
        const matcher = new KeybindingMatcher();
        expect(matcher.feed(key('g'))).toEqual({ status: 'sequence-start' });
        expect(matcher.feed(key('m'))).toEqual({ status: 'none' });
        // The matcher is not stuck: shortcuts still fire afterwards.
        expect(matcher.feed(key('?'))).toEqual({ status: 'action', id: 'help' });
    });

    it('a pending sequence expires so a later key is not swallowed', () => {
        const scheduled: Array<() => void> = [];
        const matcher = new KeybindingMatcher(SHORTCUTS, {
            setTimeout: fn => {
                scheduled.push(fn);
                return scheduled.length;
            },
            clearTimeout: () => {},
        });
        expect(matcher.feed(key('g'))).toEqual({ status: 'sequence-start' });
        // Fire the expiry callback.
        scheduled[0]?.();
        // 't' now acts as a plain key: not a binding, nothing swallowed.
        expect(matcher.feed(key('t'))).toEqual({ status: 'none' });
    });

    it('cancel() drops a pending sequence immediately', () => {
        const matcher = new KeybindingMatcher();
        expect(matcher.feed(key('g'))).toEqual({ status: 'sequence-start' });
        matcher.cancel();
        // The next key must not be treated as a chord suffix.
        expect(matcher.feed(key('c'))).toEqual({ status: 'none' });
    });
});
