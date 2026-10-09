# ADR-022: WCAG 2.1 Level AA as the Accessibility Standard

Date: 2026-10-09

Status: Accepted

## Context

Erledigen is a calendar book people live in daily, and v0.12.0 is the
accessibility build: full keyboard operability (USE-9), screen reader
flows (USE-10), contrast and reduced motion (USE-11), labeled forms
(USE-12), and the automated audit (USE-13). A standard had to be
named before the work could be measured against it. WCAG 2.0 is
superseded within the industry, WCAG 2.2 adds criteria (focus
appearance, dragging alternatives) that overlap the roadmap's later
stories, and WCAG 3.0 is not yet a recommendation. Level AAA is not
a realistic target for any product -- it forbids things like
low-contrast design languages outright.

The machine-detectable share of the standard is roughly 30-40% of
the problem; screen reader behavior, focus order feel, and
real-world announcement behavior can only be verified by a human
using the assistive technology.

## Decision

**WCAG 2.1 Level AA** is the accessibility standard for every
user-facing surface, in both themes and all accent schemes.

Enforcement is layered, all in CI:

- **axe-core** runs in the e2e suite over the page and every modal
  in both themes, with zero allowed violations against the
  `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` tags (USE-13).
- **A contrast unit test** parses `app.css` and asserts every
  text-bearing token pair, all themes and accent schemes (USE-11).
- **svelte-check** a11y rules run with `--fail-on-warnings`.
- **The manual half is required, not optional**: the NVDA (Windows)
  and VoiceOver (macOS) passes over the core flows -- add task,
  complete task, navigate the day list, open search, modal focus
  behavior -- are documented as a checklist in
  [docs/build/standards/accessibility.md](../../standards/accessibility.md)
  and must be walked by a human before a version that changes
  interaction surfaces is released.

Two product decisions ride along:

- **No `role="application"`** on the app shell: it would push screen
  readers out of browse mode for the whole page. The app is ordinary
  widgets (buttons, inputs, lists) that browse mode reads correctly;
  single-key shortcuts remain available because every control is a
  real focusable element.
- **Reduced motion follows the OS setting** globally (CSS kill
  switch + the JS-side `motion.ts` gate), shared with USE-6 --
  `prefers-reduced-motion` is honored by every animation and
  transition in the app.

## Rationale

WCAG 2.1 AA is the floor that public-sector procurement (EN 301 549,
Section 508) and every serious audit tool align to, so it makes the
standard checkable by the tools the ecosystem already ships. Naming
the level explicitly (rather than "we care about accessibility")
makes the automated layers enforceable and gives the manual passes a
concrete rubric instead of a vibe.

## Consequences

- The light theme's ink grades are set by the 4.5:1 line, not by
  taste alone; changing a color token now requires the contrast
  test to stay green (USE-11's test is the guardrail).
- New surfaces must be added to the axe audit list to keep the
  "every page/modal checked per run" promise true.
- The manual passes are a standing cost: they cannot be automated
  away, and skipping them silently degrades the human half of the
  standard. The checklist records each pass with a date.
- Aim higher where cheap (AAA contrast on body text is already met),
  but AA is the contract, not the aspiration.