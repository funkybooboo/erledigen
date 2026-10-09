import { describe, expect, test } from 'bun:test';
import { TAG_COLORS } from '../constants';
import type { TagColorId } from '../types/userPreferences';
import { leastUsedTagColor } from './tagKinds';

/** USE-4 auto-assignment policy: every new tag takes the palette color
 *  used by the fewest tags, ties breaking by palette order. */
describe('leastUsedTagColor', () => {
    test('picks the first palette color from an empty map', () => {
        expect(leastUsedTagColor({})).toBe('coral');
    });

    test('picks the least-used color in palette order', () => {
        expect(leastUsedTagColor({ a: 'coral' })).toBe('amber');
        expect(leastUsedTagColor({ a: 'coral', b: 'amber' })).toBe('lime');
        // One of each except coral: coral comes back first.
        const almostFull: Record<string, TagColorId> = {};
        for (const color of TAG_COLORS.slice(1)) almostFull[color] = color;
        expect(leastUsedTagColor(almostFull)).toBe('coral');
    });

    test('cycles the whole palette before reusing a color twice', () => {
        const assignments: Record<string, TagColorId> = {};
        for (const tag of ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9']) {
            assignments[tag] = leastUsedTagColor(assignments);
        }
        // Eight palette entries: the ninth tag reuses coral, but every
        // other color was used exactly once before it does.
        const counts = new Map<TagColorId, number>();
        for (const color of Object.values(assignments)) {
            counts.set(color, (counts.get(color) ?? 0) + 1);
        }
        expect(counts.get('coral')).toBe(2);
        expect(counts.get('amber')).toBe(1);
        expect(counts.get('slate')).toBe(1);
    });

    test('ignores values outside the palette', () => {
        const polluted = { a: 'sparkly' } as unknown as Record<string, TagColorId>;
        expect(leastUsedTagColor(polluted)).toBe('coral');
    });
});
