/**
 * Markdown renderer tests (v0.10.0).
 *
 * Two layers:
 * - the constructive grammar: every block and inline construct renders
 *   to the expected shape
 * - the ADVERSARIAL battery: inputs crafted to smuggle markup. This is
 *   the suite the roadmap's DoD names ("XSS sanitization tested with
 *   adversarial inputs") -- safe-by-construction means the output can
 *   only ever contain this module's own tags with fully escaped text.
 */

import { describe, expect, test } from 'bun:test';
import { renderInlineMarkdown, renderMarkdown } from './markdown';

/** The output must contain NO tag beyond the renderer's own allowlist,
 *  and no attribute beyond the ones the renderer itself writes. */

const KNOWN_ATTRIBUTES = new Set([
    'class',
    'data-line',
    'data-first-line',
    'data-last-line',
    'data-depth',
    'href',
    'rel',
    'aria-hidden',
]);

/** Walk a rendered tag the way an HTML parser would -- respecting
 *  quoted attribute values -- and return the attribute NAMES it
 *  declares. Escaped quotes inside values (&quot;) never end a value,
 *  so text smuggled into a URL cannot masquerade as an attribute. */
function attributeNamesOfTag(tag: string): string[] {
    const names: string[] = [];
    let inQuote = false;
    for (let i = 0; i < tag.length; i++) {
        const ch = tag[i] ?? '';
        if (inQuote) {
            if (ch === '"') inQuote = false;
            continue;
        }
        if (ch === '"') {
            inQuote = true;
            continue;
        }
        if (/\s/.test(ch)) {
            const match = /^([a-zA-Z-]+)=/.exec(tag.slice(i + 1));
            if (match?.[1]) names.push(match[1].toLowerCase());
        }
    }
    return names;
}

/** No tag may declare anything beyond the renderer's own attributes --
 *  the real test of "user text can never become markup". */
function assertNoForeignAttributes(html: string): void {
    for (const tag of html.match(/<[a-z0-9]+[^>]*>/gi) ?? []) {
        for (const name of attributeNamesOfTag(tag)) {
            expect(KNOWN_ATTRIBUTES.has(name), `foreign attribute "${name}" in: ${tag}`).toBe(true);
            expect(name.startsWith('on'), `event handler attribute in: ${tag}`).toBe(false);
        }
    }
}

function rendererTagNames(html: string): string[] {
    const names: string[] = [];
    for (const match of html.matchAll(/<\/?([a-z0-9]+)/gi)) {
        if (match[1]) names.push(match[1].toLowerCase());
    }
    return names;
}

describe('renderMarkdown -- blocks', () => {
    test('empty input renders nothing', () => {
        expect(renderMarkdown('')).toBe('');
    });

    test('a plain line renders as a paragraph', () => {
        expect(renderMarkdown('buy milk')).toBe('<p>buy milk</p>');
    });

    test('each line is its own paragraph -- no soft-wrap joining', () => {
        expect(renderMarkdown('one\ntwo')).toBe('<p>one</p><p>two</p>');
    });

    test('blank lines render no output (idle mode)', () => {
        expect(renderMarkdown('a\n\nb')).toBe('<p>a</p><p>b</p>');
    });

    test('blank lines get a clickable placeholder in line-data mode', () => {
        expect(renderMarkdown('a\n\nb', { withLineData: true })).toBe(
            '<p data-line="0">a</p><div class="md-blank" data-line="1"></div><p data-line="2">b</p>',
        );
    });

    test('headings render per level', () => {
        expect(renderMarkdown('# one')).toBe('<h1>one</h1>');
        expect(renderMarkdown('## two')).toBe('<h2>two</h2>');
        expect(renderMarkdown('###### six')).toBe('<h6>six</h6>');
    });

    test('a hash without a space stays plain text (tag collision rule)', () => {
        expect(renderMarkdown('#work item')).toBe('<p>#work item</p>');
        expect(renderMarkdown('#work')).toBe('<p>#work</p>');
    });

    test('seven hashes are not a heading', () => {
        expect(renderMarkdown('####### seven')).toBe('<p>####### seven</p>');
    });

    test('a bare hash is an empty heading', () => {
        expect(renderMarkdown('#')).toBe('<h1></h1>');
    });

    test('fenced code blocks escape their content and keep the language', () => {
        const html = renderMarkdown('```js\nconst x = 1 < 2;\nconst y = "s";\n```');
        expect(html).toBe(
            '<pre><code class="language-js">const x = 1 &lt; 2;\nconst y = &quot;s&quot;;</code></pre>',
        );
    });

    test('tilde fences work like backtick fences', () => {
        expect(renderMarkdown('~~~\nplain\n~~~')).toBe('<pre><code>plain</code></pre>');
    });

    test('an unclosed fence renders the rest as code', () => {
        expect(renderMarkdown('```\nall code')).toBe('<pre><code>all code</code></pre>');
    });

    test('an unsafe info string gets no language class', () => {
        expect(renderMarkdown('```x" onclick="evil\nplain\n```')).toBe(
            '<pre><code>plain</code></pre>',
        );
    });

    test('lists render with literal markers (handwriting fidelity)', () => {
        expect(renderMarkdown('- one\n- two')).toBe(
            '<ul class="md-list">' +
                '<li class="md-item" data-depth="0"><span class="md-marker" aria-hidden="true">-</span><span class="md-item-text">one</span></li>' +
                '<li class="md-item" data-depth="0"><span class="md-marker" aria-hidden="true">-</span><span class="md-item-text">two</span></li>' +
                '</ul>',
        );
    });

    test('star, plus, and ordered markers all render as written', () => {
        expect(renderMarkdown('* a\n+ b\n3. c')).toContain('>*<');
        expect(renderMarkdown('* a\n+ b\n3. c')).toContain('3.');
    });

    test('indented items nest by depth', () => {
        const html = renderMarkdown('- top\n  - nested');
        expect(html).toContain('data-depth="1"');
        expect(html.indexOf('<ul class="md-list">')).toBeLessThan(html.indexOf('data-depth="1"'));
        // The nested item's <ul> sits INSIDE the parent <li>.
        expect(html).toMatch(/<\/span><ul class="md-list">/);
    });

    test('a continuation line renders inside its item', () => {
        const html = renderMarkdown('- item\n  more about it');
        expect(html).toContain('md-continuation');
        expect(html).toContain('more about it');
    });

    test('a non-list, non-indented line ends the list group', () => {
        expect(renderMarkdown('- a\nplain\n- b')).toBe(
            '<ul class="md-list">' +
                '<li class="md-item" data-depth="0"><span class="md-marker" aria-hidden="true">-</span><span class="md-item-text">a</span></li>' +
                '</ul><p>plain</p>' +
                '<ul class="md-list">' +
                '<li class="md-item" data-depth="0"><span class="md-marker" aria-hidden="true">-</span><span class="md-item-text">b</span></li>' +
                '</ul>',
        );
    });
});

describe('renderMarkdown -- inline', () => {
    test('bold with asterisks and underscores', () => {
        expect(renderMarkdown('**bold**')).toBe('<p><strong>bold</strong></p>');
        expect(renderMarkdown('__bold__')).toBe('<p><strong>bold</strong></p>');
    });

    test('italic with asterisks and underscores', () => {
        expect(renderMarkdown('*it*')).toBe('<p><em>it</em></p>');
        expect(renderMarkdown('_it_')).toBe('<p><em>it</em></p>');
    });

    test('underscore italic needs word boundaries (snake_case stays literal)', () => {
        expect(renderMarkdown('snake_case_word')).toBe('<p>snake_case_word</p>');
    });

    test('nested emphasis renders inside out', () => {
        expect(renderMarkdown('**bold with *italic* inside**')).toBe(
            '<p><strong>bold with <em>italic</em> inside</strong></p>',
        );
    });

    test('a triple-asterisk close leaves the surplus as literal text', () => {
        // Deliberate simplification (documented): the scanner closes the
        // outer emphasis at the first `**` it sees; a trailing `***` run
        // cannot close two levels at once. The result stays SAFE, just
        // not CommonMarkdown-pretty.
        expect(renderMarkdown('**bold *and italic***')).toBe(
            '<p><strong>bold *and italic</strong>*</p>',
        );
    });

    test('code spans are literal -- no markdown inside', () => {
        expect(renderMarkdown('use `**not bold**` here')).toBe(
            '<p>use <code>**not bold**</code> here</p>',
        );
    });

    test('links render with a validated href', () => {
        expect(renderMarkdown('[docs](https://example.com)')).toBe(
            '<p><a href="https://example.com" rel="noopener noreferrer">docs</a></p>',
        );
    });

    test('markdown renders inside link labels', () => {
        expect(renderMarkdown('[**bold** link](https://example.com)')).toBe(
            '<p><a href="https://example.com" rel="noopener noreferrer"><strong>bold</strong> link</a></p>',
        );
    });

    test('mailto links render', () => {
        expect(renderMarkdown('[mail](mailto:a@b.example)')).toContain('mailto:a@b.example');
    });

    test('backslash escapes keep a special character literal', () => {
        expect(renderMarkdown('\\*not italic\\*')).toBe('<p>*not italic*</p>');
        expect(renderMarkdown('a \\`code\\`')).toBe('<p>a `code`</p>');
    });

    test('unclosed constructs stay literal text', () => {
        expect(renderMarkdown('**dangling')).toBe('<p>**dangling</p>');
        expect(renderMarkdown('*open')).toBe('<p>*open</p>');
        expect(renderMarkdown('`unclosed')).toBe('<p>`unclosed</p>');
        expect(renderMarkdown('[unclosed](https://x.example')).toBe(
            '<p>[unclosed](https://x.example</p>',
        );
    });
});

describe('renderMarkdown -- line data (live editor)', () => {
    test('blocks carry data-line in editor mode', () => {
        const html = renderMarkdown('note\n# head', { withLineData: true });
        expect(html).toBe('<p data-line="0">note</p><h1 data-line="1">head</h1>');
    });

    test('firstLine offsets the emitted numbers', () => {
        const html = renderMarkdown('note', { withLineData: true, firstLine: 4 });
        expect(html).toBe('<p data-line="4">note</p>');
    });

    test('list items each carry their own data-line', () => {
        const html = renderMarkdown('- a\n- b', { withLineData: true });
        expect(html).toContain('data-line="0"');
        expect(html).toContain('data-line="1"');
    });

    test('code blocks carry first/last line spans', () => {
        const html = renderMarkdown('```\nx\ny\n```', { withLineData: true });
        expect(html).toContain('data-first-line="0"');
        expect(html).toContain('data-last-line="2"');
    });
});

describe('renderInlineMarkdown -- task titles', () => {
    test('headings render in the single-line form', () => {
        expect(renderInlineMarkdown('# Morning')).toBe('<h1>Morning</h1>');
    });

    test('inline constructs render in the single-line form', () => {
        expect(renderInlineMarkdown('buy **milk**')).toBe('buy <strong>milk</strong>');
    });

    test('list markers are NOT parsed in titles', () => {
        expect(renderInlineMarkdown('- not a list')).toBe('- not a list');
    });
});

describe('markdown -- adversarial inputs (the XSS battery)', () => {
    const ADVERSARIAL = [
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        '<iframe src="https://evil.example"></iframe>',
        '<a href="javascript:alert(1)">click</a>',
        '[click](javascript:alert(1))',
        '[click](JAVASCRIPT:alert(1))',
        '[click](data:text/html,<script>alert(1)</script>)',
        '[click](vbscript:msgbox)',
        '[click](file:///etc/passwd)',
        '<body onload=alert(1)>',
        '"><svg onload=alert(1)>',
        "<a href='javascript:alert(1)'>x</a>",
        '&lt;script&gt;alert(1)&lt;/script&gt;',
        '&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;',
        'javascript&#58;alert(1)',
        '```\n<script>alert(1)</script>\n```',
        '- <b>bold injection</b>',
        '# <img src=x onerror=alert(1)>',
        '**<script>alert(1)</script>**',
        '`<script>alert(1)</script>`',
        '[<script>alert(1)</script>](https://x.example)',
        '<style>*{display:none}</style>',
        '<form action="javascript:alert(1)"><input type=submit></form>',
        'onmouseover=alert(1)',
    ];

    test('no adversarial input can introduce a non-allowlisted tag', () => {
        for (const input of ADVERSARIAL) {
            const html = renderMarkdown(input);
            for (const tag of rendererTagNames(html)) {
                expect([
                    'h1',
                    'h2',
                    'h3',
                    'h4',
                    'h5',
                    'h6',
                    'p',
                    'pre',
                    'code',
                    'ul',
                    'li',
                    'div',
                    'span',
                    'strong',
                    'em',
                    'a',
                ]).toContain(tag);
            }
        }
    });

    test('script/iframe/img/style/form can never survive as markup', () => {
        const banned = /<(script|iframe|img|style|form|svg|body|input|b)\b/i;
        for (const input of ADVERSARIAL) {
            expect(renderMarkdown(input)).not.toMatch(banned);
        }
    });

    test('javascript: and data: hrefs are never emitted', () => {
        for (const input of ADVERSARIAL) {
            expect(renderMarkdown(input)).not.toMatch(/href="(javascript|data|vbscript|file):/i);
        }
    });

    test('user text can never introduce an attribute or event handler', () => {
        // A quote-aware attribute walk: escaped quotes (&quot;) stay inside
        // attribute VALUES, so smuggled "onmouseover=..." text can never
        // register as an attribute.
        for (const input of ADVERSARIAL) {
            assertNoForeignAttributes(renderMarkdown(input));
            assertNoForeignAttributes(renderMarkdown(input, { withLineData: true }));
        }
    });

    test('angle brackets always escape, even inside constructs', () => {
        expect(renderMarkdown('<script>')).toBe('<p>&lt;script&gt;</p>');
        expect(renderMarkdown('**<b>**')).toBe('<p><strong>&lt;b&gt;</strong></p>');
        expect(renderMarkdown('`<i>`')).toBe('<p><code>&lt;i&gt;</code></p>');
    });

    test('quotes inside link URLs cannot break out of the href', () => {
        const html = renderMarkdown('[x](https://e.example/" onmouseover="alert(1)');
        // The URL passes the scheme check, so it renders -- but the quote
        // is escaped and the payload stays inert VALUE text.
        assertNoForeignAttributes(html);
        expect(html).toContain('href="https://e.example/&quot;');
    });

    test('entity-encoded payloads stay inert text', () => {
        // &lt;script&gt; must render as VISIBLE escaped text, not markup.
        expect(renderMarkdown('&lt;script&gt;')).toBe('<p>&amp;lt;script&amp;gt;</p>');
    });

    test('a javascript: scheme smuggled with entities in the URL is rejected', () => {
        expect(renderMarkdown('[x](javascript&#58;alert(1))')).not.toContain('href=');
    });
});
