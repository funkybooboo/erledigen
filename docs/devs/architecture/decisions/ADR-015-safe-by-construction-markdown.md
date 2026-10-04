# ADR-015: Safe-by-Construction Markdown Renderer (No DOMPurify)

**Status**: Accepted
**Date**: 2026-10-04

## Context

v0.10.0 renders user text as Markdown in three places: task notes,
day notes, and task titles. The original roadmap note (v0.10.0
technical considerations) proposed `marked` for parsing plus
`DOMPurify` for sanitizing the resulting HTML.

Three constraints made that pairing the wrong fit here:

1. **The client bundle budget was effectively full.** The browser
   payload gate stood at 624 KiB with the tree already at 623 KiB.
   `marked` + `DOMPurify` add roughly 60 KB of raw payload -- the
   budget policy (code-standards.md) says to think twice before
   adding dependencies, and this one cannot fit at all.
2. **SvelteKit server-renders the app.** DOMPurify requires a DOM;
   on the server that means pulling in jsdom (a huge server-side
   dependency) or rendering markdown only in the browser -- which
   breaks hydration, because the server's HTML must match the
   client's first render.
3. **The required grammar is tiny.** The roadmap asks for headings,
   bold, italic, inline code, code blocks, lists, and links. A full
   CommonMark implementation defends a much larger surface than the
   product uses.

## Decision

Markdown rendering is a hand-written, escape-first renderer in
`packages/shared/src/utils/markdown.ts`. It is **safe by
construction** rather than sanitized after the fact:

- Every character of user text is HTML-escaped at its emission point;
  raw text can never reach the output as markup.
- The only tags the renderer emits are its own literals (`h1`-`h6`,
  `p`, `pre`, `code`, `ul`, `li`, `div`, `span`, `strong`, `em`, `a`).
  There is no raw-HTML passthrough at all, so there is nothing for a
  sanitizer to catch.
- Link URLs are scheme-allowlisted (http, https, mailto) and emitted
  escaped inside a quoted attribute; quotes in user text can never
  break out of an attribute value.
- The grammar is line-oriented (every non-blank source line is one
  block; no soft-wrap joining, no lazy continuation), matching the
  paper-calendar identity (ADR-010) and giving the live editor a
  1:1 line-to-block mapping.

Security is enforced by an adversarial test battery in
`markdown.test.ts`: script/img/iframe/style/form injection,
`javascript:`/`data:`/`vbscript:` URLs, entity-encoded payloads,
quote-breakout attempts in hrefs, and a quote-aware attribute walk
asserting no tag can declare anything outside the renderer's own
attribute set.

## Consequences

### Positive

- Zero new dependencies; a few KB of code instead of ~60 KB.
- Identical output on server and client -- SSR and hydration stay
  correct with no jsdom.
- The security property is testable as a pure function with fast
  unit tests, not dependent on a DOM library's behavior.
- The line-oriented grammar makes the Obsidian-style live editor
  (click a rendered line -> edit that source line) trivial to map.

### Negative

- Not CommonMark. Deliberate simplifications: no blockquotes, tables,
  or footnotes; a trailing `***` cannot close two emphasis levels at
  once; paragraphs never soft-wrap. Users who paste CommonMark-heavy
  text get degraded (but safe) rendering.
- Any new Markdown construct must be implemented and adversarially
  tested here rather than inherited from a library.

### Mitigations

- The roadmap's v0.10.0 section carries this decision as an as-built
  note replacing the marked/DOMPurify suggestion.
- A new construct is a small, contained addition to one pure module
  with an existing adversarial suite to extend.