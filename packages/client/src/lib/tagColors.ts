/**
 * Tag colors (USE-4): resolve a tag to its CSS color.
 *
 * The precedence chain, first match wins:
 *   1. an explicit override in preferencesStore.tagColors (user recolor
 *      or a past auto-assignment -- both persist in UserPreferences)
 *   2. the priority semantic: #p1/#p2/#p3 use the logo's pill tokens
 *      (--color-p1/2/3) unless the user recolored them
 *   3. null -- the caller renders the neutral chip
 *
 * Returns the raw `var(--tag-sky)` / `var(--color-p1)` token VALUE (not a
 * hex): the tokens carry light and dark variants, so callers just drop
 * the value into an inline style and both themes read correctly.
 */

import { PRIORITY_TAGS, TAG_COLORS } from '@erledigen/shared';
import { preferencesStore } from './stores/preferencesStore.svelte';

/** The color token for a tag, or null when the tag has no color. */
export function tagColorVar(tag: string): string | null {
    const explicit = preferencesStore.tagColors[tag];
    if (explicit !== undefined && TAG_COLORS.includes(explicit)) {
        return `var(--tag-${explicit})`;
    }
    const priorityIndex = PRIORITY_TAGS.indexOf(tag as (typeof PRIORITY_TAGS)[number]);
    if (priorityIndex !== -1) {
        return `var(--color-p${priorityIndex + 1})`;
    }
    return null;
}

/** Inline style that tints a chip with the tag's color: a pastel
 *  background (the color mixed into the surface) with a text color
 *  derived from the same hue. Null color -> empty string (the neutral
 *  chip style).
 *
 *  The text mixes the hue 55% into --color-text (USE-11): in the light
 *  theme that darkens the hue toward the ink, in the dark theme it
 *  brightens it toward the paper -- one formula keeps every palette
 *  entry (and the #p1/#p2/#p3 pills, whose logo hues are the worst
 *  offenders on pastel) above the 4.5:1 AA line on the 14% pastel
 *  background in both themes. The mix mirrors CSS color-mix(in oklab)
 *  and is asserted in src/lib/contrast.test.ts. */
export function tagChipStyle(tag: string): string {
    const color = tagColorVar(tag);
    if (color === null) return '';
    const fg = `color-mix(in oklab, ${color} 55%, var(--color-text))`;
    return `color: ${fg}; background: color-mix(in oklab, ${color} 14%, var(--color-surface)); border-color: color-mix(in oklab, ${color} 30%, var(--color-border));`;
}
