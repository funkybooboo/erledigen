/**
 * Tag-list parsing helpers.
 *
 * `parseTags` splits a comma-separated edit field (the task detail
 * modal's tags input) into a clean list.
 *
 * `extractInlineTags` strips `#tag` tokens out of free-form text (the
 * inline add inputs: "buy milk tomorrow #work #p1" becomes text "buy
 * milk tomorrow" plus tags [work, p1]) -- TeuxDeux-style input where
 * hashtags organize as you type.
 */

/** An `#inline-tag` token: starts with a letter/digit, then word chars or
 *  hyphens (matches the app's tag convention, incl. `project:` names). */
const INLINE_TAG_RE = /(?:^|\s)#([A-Za-z0-9][A-Za-z0-9_-]*)/g;

export function parseTags(input: string): string[] {
    return input
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
}

export interface ExtractedInlineTags {
    /** The text with every `#tag` token removed, whitespace normalized. */
    text: string;
    /** The extracted tags, lowercased, de-duplicated, in first-seen order. */
    tags: string[];
}

/**
 * Extract `#tag` tokens from free text.
 *
 * Returns the text unchanged (tags: []) when it contains no tags or when
 * stripping the tags would leave nothing -- a text like "#p1" alone is
 * not a task, so the tokens stay literal for the caller to reject.
 */
export function extractInlineTags(input: string): ExtractedInlineTags {
    const trimmed = input.trim();
    const tags: string[] = [];
    let sawTag = false;
    const text = trimmed.replace(INLINE_TAG_RE, (_match, raw: string) => {
        sawTag = true;
        const tag = raw.toLowerCase();
        if (!tags.includes(tag)) tags.push(tag);
        return ' ';
    });
    if (!sawTag || text.trim().length === 0) {
        return { text: trimmed, tags: [] };
    }
    return { text: text.replace(/\s+/g, ' ').trim(), tags };
}
