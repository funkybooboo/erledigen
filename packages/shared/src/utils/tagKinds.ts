import { TAG_COLORS } from '../constants';
import type { TagColorId, TagKind } from '../types/userPreferences';

/** Pick the palette color already used by the fewest tags (USE-4's
 *  auto-assignment): ties break by palette order, so distinct tags stay
 *  visually distinct as a set. Pure -- lives in shared so both sides
 *  and the unit tests can use it without the client's runes store. */
export function leastUsedTagColor(assignments: Record<string, TagColorId>): TagColorId {
    const counts = new Map<TagColorId, number>();
    for (const color of Object.values(assignments)) {
        if (TAG_COLORS.includes(color)) counts.set(color, (counts.get(color) ?? 0) + 1);
    }
    let best: TagColorId = TAG_COLORS[0];
    let bestCount = counts.get(best) ?? 0;
    for (const color of TAG_COLORS) {
        const count = counts.get(color) ?? 0;
        if (count < bestCount) {
            best = color;
            bestCount = count;
        }
    }
    return best;
}

export function resolveTagKind(
    tag: string,
    tagKinds: TagKind[],
    tagKindMap: Record<string, string>,
): TagKind | null {
    const explicit = tagKindMap[tag];
    if (explicit) {
        return tagKinds.find(k => k.id === explicit) ?? null;
    }
    for (const kind of tagKinds) {
        if (kind.prefix && tag.startsWith(kind.prefix)) {
            return kind;
        }
    }
    return null;
}

export function getTagsByKind(
    allTags: string[],
    tagKinds: TagKind[],
    tagKindMap: Record<string, string>,
): Map<TagKind | null, string[]> {
    const result = new Map<TagKind | null, string[]>();
    for (const tag of allTags) {
        const kind = resolveTagKind(tag, tagKinds, tagKindMap);
        const existing = result.get(kind) ?? [];
        existing.push(tag);
        result.set(kind, existing);
    }
    return result;
}
