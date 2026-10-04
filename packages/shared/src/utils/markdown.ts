/**
 * Markdown rendering for notes and task titles (v0.10.0, ADR-015).
 *
 * Safe by construction: the renderer is an ESCAPE-FIRST pipeline that
 * never passes raw HTML through. Every character of user text is
 * HTML-escaped at its emission point, and the only tags the renderer
 * ever emits come from this file's own literals -- headings, code
 * blocks, lists, and the inline constructs (bold, italic, code, links).
 * Link URLs are scheme-allowlisted (http, https, mailto); everything
 * else stays literal text. There is no sanitizer stage because there
 * is nothing to sanitize: untrusted content cannot become markup.
 *
 * The grammar is deliberately LINE-ORIENTED, matching the product's
 * paper-calendar identity (ADR-010): every non-blank source line is
 * exactly one block. There is no soft-wrap joining of consecutive
 * lines into one paragraph and no lazy continuation -- what you write
 * line by line is what renders line by line. This also gives the live
 * editor (LiveMarkdownEditor.svelte) a 1:1 mapping between source
 * lines and rendered blocks, so a click on rendered markdown can
 * always open the exact source line for editing.
 *
 * Block constructs: ATX headings (`# ` .. `###### `), fenced code
 * blocks (``` or ~~~), lists (`- `, `* `, `+ `, `1. `, `2) ...` with
 * nesting by indentation), and single-line paragraphs. Blank lines
 * render vertical space.
 *
 * Inline constructs (inside any text content): `code`, **bold**,
 * __bold__, *italic*, _italic_ (word-boundary rule for `_`), links
 * `[text](url)`, and backslash escapes for the special characters
 * (`\*` renders a literal `*`).
 */

export interface RenderMarkdownOptions {
    /** Emit `data-line`/`data-first-line`/`data-last-line` attributes
     *  on block elements so the live editor can map clicks back to
     *  source lines. Default false (idle rendering). */
    withLineData?: boolean;
    /** Number the first source line as `firstLine` instead of 0. The
     *  live editor renders the lines around the caret as two fragments
     *  and needs absolute line numbers in each. */
    firstLine?: number;
}

// ---------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------

/** Escape a plain-text run for HTML emission. Called at EVERY point
 *  user text reaches the output -- the security hinge of the design. */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Allowed link schemes; anything else renders as literal text. */
function safeHref(rawUrl: string): string | null {
    const url = rawUrl.trim();
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) {
        return escapeHtml(url);
    }
    return null;
}

// ---------------------------------------------------------------------
// Inline rendering
// ---------------------------------------------------------------------

/** Characters that can open an inline construct or be backslash-escaped. */
const INLINE_SPECIALS = new Set(['`', '*', '_', '[', '\\']);

/**
 * Render one text run's inline markdown. Recursive: emphasis content
 * and link text are themselves inline-rendered; code-span content is
 * NOT (code spans are literal).
 */
function renderInline(raw: string): string {
    const out: string[] = [];
    let plain = '';
    const flushPlain = (): void => {
        if (plain.length > 0) {
            out.push(escapeHtml(plain));
            plain = '';
        }
    };

    let i = 0;
    while (i < raw.length) {
        const ch = raw[i] ?? '';
        const next = raw[i + 1] ?? '';

        // Backslash escape: `\*` etc. emits the literal character.
        if (ch === '\\' && INLINE_SPECIALS.has(next)) {
            plain += next;
            i += 2;
            continue;
        }

        // Code span: `...` -- content is literal (no nested markdown).
        if (ch === '`') {
            const end = raw.indexOf('`', i + 1);
            if (end !== -1 && end > i + 1) {
                flushPlain();
                out.push(`<code>${escapeHtml(raw.slice(i + 1, end))}</code>`);
                i = end + 1;
                continue;
            }
        }

        if (ch === '*' && raw.startsWith('**', i)) {
            const end = findEmphasisEnd(raw, i + 2, '**', false);
            if (end !== -1) {
                flushPlain();
                out.push(`<strong>${renderInline(raw.slice(i + 2, end))}</strong>`);
                i = end + 2;
                continue;
            }
        }

        if (ch === '_' && raw.startsWith('__', i)) {
            const end = findEmphasisEnd(raw, i + 2, '__', false);
            if (end !== -1) {
                flushPlain();
                out.push(`<strong>${renderInline(raw.slice(i + 2, end))}</strong>`);
                i = end + 2;
                continue;
            }
        }

        if (ch === '*' || ch === '_') {
            // Italic. `_` uses the word-boundary rule so
            // snake_case_words never italicize mid-word.
            const end = findEmphasisEnd(raw, i + 1, ch, ch === '_');
            if (end !== -1) {
                flushPlain();
                out.push(`<em>${renderInline(raw.slice(i + 1, end))}</em>`);
                i = end + 1;
                continue;
            }
        }

        if (ch === '[') {
            const rendered = tryRenderLink(raw, i);
            if (rendered !== null) {
                flushPlain();
                out.push(rendered.html);
                i = rendered.next;
                continue;
            }
        }

        plain += ch;
        i += 1;
    }

    flushPlain();
    return out.join('');
}

/**
 * Find the closing delimiter for an emphasis run starting after
 * `contentStart`. When `wordBoundary` is set (the `_` rule), a closing
 * delimiter that is immediately followed by a word character is
 * rejected -- `snake_case_word` must not italicize.
 */
function findEmphasisEnd(
    raw: string,
    contentStart: number,
    delimiter: string,
    wordBoundary: boolean,
): number {
    for (let end = contentStart + 1; end <= raw.length - delimiter.length; end++) {
        if (raw.startsWith(delimiter, end)) {
            if (wordBoundary) {
                const after = raw[end + delimiter.length] ?? '';
                if (/[A-Za-z0-9_]/.test(after)) continue;
            }
            // An escaped closing delimiter does not close.
            if (isEscaped(raw, end)) continue;
            return end;
        }
    }
    return -1;
}

/** Whether the character at `index` is preceded by an odd number of
 *  backslashes (i.e. escaped). */
function isEscaped(raw: string, index: number): boolean {
    let slashes = 0;
    let j = index - 1;
    while (j >= 0 && raw[j] === '\\') {
        slashes += 1;
        j -= 1;
    }
    return slashes % 2 === 1;
}

/** Try to parse `[text](url)` at `start`; null when it is not a link. */
function tryRenderLink(raw: string, start: number): { html: string; next: number } | null {
    const textEnd = raw.indexOf(']', start + 1);
    if (textEnd === -1 || raw[textEnd + 1] !== '(') return null;
    const urlEnd = raw.indexOf(')', textEnd + 2);
    if (urlEnd === -1) return null;

    // The URL is validated on the RAW string (before escaping) so the
    // scheme check sees exactly what the user typed; safeHref escapes
    // for attribute emission.
    const href = safeHref(raw.slice(textEnd + 2, urlEnd));
    if (href === null) return null;

    const label = renderInline(raw.slice(start + 1, textEnd));
    return {
        html: `<a href="${href}" rel="noopener noreferrer">${label}</a>`,
        next: urlEnd + 1,
    };
}

// ---------------------------------------------------------------------
// Block parsing
// ---------------------------------------------------------------------

type Block =
    | { kind: 'blank'; line: number }
    | { kind: 'heading'; line: number; level: HeadingLevel; text: string }
    | { kind: 'paragraph'; line: number; text: string }
    | { kind: 'code'; firstLine: number; lastLine: number; info: string; content: string[] }
    | { kind: 'list'; items: ListItemNode[] };

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

interface ListItemNode {
    /** Source line of the item marker. */
    line: number;
    /** Nesting depth (floor(indent / 2), clamped 0..4). */
    depth: number;
    /** The literal marker the user wrote (`-`, `*`, `+`, `1.`, `2)`). */
    marker: string;
    /** The item text after the marker. */
    text: string;
    /** Continuation lines indented under this item. */
    continuations: { line: number; text: string }[];
    children: ListItemNode[];
}

const HEADING_RE = /^(#{1,6})(?:\s+(.*))?$/;
const CODE_FENCE_RE = /^(`{3,}|~{3,})(?:\s*(.*))?$/;
const LIST_ITEM_RE = /^(\s*)([-*+]|\d{1,9}[.)])(?:\s+(.*))?$/;

function parseHeading(line: string): { level: HeadingLevel; text: string } | null {
    const match = HEADING_RE.exec(line);
    if (!match) return null;
    // `#foo` (no space) is plain text, not a heading -- the same rule
    // that keeps "#word" tags distinct from "# Morning" section titles.
    if (match[2] === undefined && !line.endsWith('#')) return null;
    const hashes = match[1] ?? '';
    return { level: hashes.length as HeadingLevel, text: match[2] ?? '' };
}

function parseBlocks(lines: string[]): Block[] {
    const blocks: Block[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i] ?? '';

        if (line.trim() === '') {
            blocks.push({ kind: 'blank', line: i });
            i += 1;
            continue;
        }

        // Fenced code block: ``` or ~~~ (>= 3), until the matching
        // fence or end of input (an unclosed fence renders the rest as
        // code rather than leaking into markdown).
        const fence = CODE_FENCE_RE.exec(line);
        if (fence) {
            const marker = fence[1]?.[0] === '~' ? '~~~' : '```';
            const content: string[] = [];
            let j = i + 1;
            while (j < lines.length) {
                const closing = CODE_FENCE_RE.exec(lines[j] ?? '');
                if (closing && (closing[1] ?? '').startsWith(marker)) break;
                content.push(lines[j] ?? '');
                j += 1;
            }
            blocks.push({
                kind: 'code',
                firstLine: i,
                lastLine: j - 1,
                info: (fence[2] ?? '').trim(),
                content,
            });
            i = j + 1;
            continue;
        }

        const heading = parseHeading(line);
        if (heading) {
            blocks.push({ kind: 'heading', line: i, level: heading.level, text: heading.text });
            i += 1;
            continue;
        }

        // A list group: consecutive list items plus indented continuation
        // lines. Any other line (blank included) ends the group.
        if (LIST_ITEM_RE.test(line)) {
            const [items, next] = parseListGroup(lines, i);
            blocks.push({ kind: 'list', items });
            i = next;
            continue;
        }

        blocks.push({ kind: 'paragraph', line: i, text: line });
        i += 1;
    }

    return blocks;
}

/** Parse a list group starting at `start` (a list-item line). Returns
 *  the item tree and the index of the first line after the group. */
function parseListGroup(lines: string[], start: number): [ListItemNode[], number] {
    const flat: ListItemNode[] = [];
    let i = start;
    let current: ListItemNode | null = null;

    while (i < lines.length) {
        const line = lines[i] ?? '';
        const item = LIST_ITEM_RE.exec(line);
        if (item) {
            const indent = item[1] ?? '';
            current = {
                line: i,
                depth: Math.min(4, Math.floor(indent.length / 2)),
                marker: item[2] ?? '-',
                text: item[3] ?? '',
                continuations: [],
                children: [],
            };
            flat.push(current);
            i += 1;
            continue;
        }
        // Indented non-blank line: continuation of the previous item.
        if (current !== null && /^\s{2,}\S/.test(line)) {
            current.continuations.push({ line: i, text: line });
            i += 1;
            continue;
        }
        break;
    }

    return [buildListTree(flat), i];
}

/** Nest the flat depth sequence into a tree (stack-based). */
function buildListTree(flat: ListItemNode[]): ListItemNode[] {
    const roots: ListItemNode[] = [];
    const stack: ListItemNode[] = [];
    for (const item of flat) {
        while (stack.length > 0 && (stack[stack.length - 1]?.depth ?? -1) >= item.depth) {
            stack.pop();
        }
        const parent = stack[stack.length - 1] ?? null;
        if (parent) {
            parent.children.push(item);
        } else {
            roots.push(item);
        }
        stack.push(item);
    }
    return roots;
}

// ---------------------------------------------------------------------
// Block rendering
// ---------------------------------------------------------------------

function lineAttrs(options: RenderMarkdownOptions, line: number): string {
    return options.withLineData ? ` data-line="${line + (options.firstLine ?? 0)}"` : '';
}

function spanAttrs(options: RenderMarkdownOptions, first: number, last: number): string {
    if (!options.withLineData) return '';
    const offset = options.firstLine ?? 0;
    return ` data-first-line="${first + offset}" data-last-line="${last + offset}"`;
}

/** The info string becomes a language class when it is a safe token. */
function languageClass(info: string): string {
    if (!/^[A-Za-z0-9#+_-]+$/.test(info)) return '';
    return ` class="language-${info}"`;
}

function renderListItem(item: ListItemNode, options: RenderMarkdownOptions): string {
    const childrenHtml =
        item.children.length > 0
            ? `<ul class="md-list">${item.children.map(c => renderListItem(c, options)).join('')}</ul>`
            : '';
    const continuationHtml = item.continuations
        .map(
            c =>
                `<div class="md-continuation"${lineAttrs(options, c.line)}>${renderInline(c.text.trim())}</div>`,
        )
        .join('');
    return (
        `<li class="md-item" data-depth="${item.depth}"${lineAttrs(options, item.line)}>` +
        `<span class="md-marker" aria-hidden="true">${escapeHtml(item.marker)}</span>` +
        `<span class="md-item-text">${renderInline(item.text)}</span>` +
        continuationHtml +
        childrenHtml +
        '</li>'
    );
}

function renderBlock(block: Block, options: RenderMarkdownOptions): string {
    switch (block.kind) {
        case 'blank':
            // In editor mode a blank line needs a clickable placeholder
            // element; idle rendering lets CSS margins handle the space.
            return options.withLineData
                ? `<div class="md-blank"${lineAttrs(options, block.line)}></div>`
                : '';
        case 'heading':
            return `<h${block.level}${lineAttrs(options, block.line)}>${renderInline(block.text)}</h${block.level}>`;
        case 'paragraph':
            return `<p${lineAttrs(options, block.line)}>${renderInline(block.text)}</p>`;
        case 'code': {
            const body = block.content.map(escapeHtml).join('\n');
            return (
                `<pre${spanAttrs(options, block.firstLine, block.lastLine)}>` +
                `<code${languageClass(block.info)}>${body}</code></pre>`
            );
        }
        case 'list':
            return `<ul class="md-list">${block.items.map(i => renderListItem(i, options)).join('')}</ul>`;
    }
}

/**
 * Render a markdown document to HTML. Every character of the input is
 * escaped before it can reach the output as text; the only tags in the
 * result come from this module (see ADR-015). Callers MUST wrap the
 * result in an `md-root` container (typography lives with the caller).
 */
export function renderMarkdown(text: string, options: RenderMarkdownOptions = {}): string {
    return parseBlocks(text.split('\n'))
        .map(block => renderBlock(block, options))
        .join('');
}

/**
 * Render a single line's markdown (the task-title model): the heading
 * form plus inline constructs. Lists and code fences are paragraph
 * text here -- a title is one line by definition.
 */
export function renderInlineMarkdown(text: string): string {
    const heading = parseHeading(text);
    if (heading) {
        return `<h${heading.level}>${renderInline(heading.text)}</h${heading.level}>`;
    }
    return renderInline(text);
}
