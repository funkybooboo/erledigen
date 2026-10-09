# Accessibility

The accessibility standard, the enforcement stack, and the manual
testing protocol. The standard itself is decided in
[ADR-022](../architecture/decisions/ADR-022-wcag-2-1-aa.md): WCAG 2.1
Level AA, both themes, all accent schemes.

## The standard, enforced in CI

| Layer | Gate | What it catches |
|-------|------|----------------|
| axe-core in e2e | `tests/e2e/a11y.spec.ts`, zero violations (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` tags) on the page and every modal, light and dark | The machine-detectable share: nameless controls, missing labels, structural ARIA errors, live color contrast |
| Contrast unit test | `packages/client/src/lib/contrast.test.ts` parses `app.css` | Token regressions: every text-bearing color pair in every theme and accent scheme must clear 4.5:1 |
| svelte-check | `mise run svelte-check` (`--fail-on-warnings`) | Static a11y rules: unlabeled elements, invalid ARIA, runes misuse |

A note on the axes of the work:

- **Color tokens are contrast-constrained**: `--color-text-muted`
  is reserved for placeholders and decorative icons -- never for
  readable text; `--color-text-secondary` and the status hues are
  the grades that pass AA on the surfaces they render on. Changing
  a token means keeping the contrast test green.
- **Chip text is derived, not raw**: tag and priority chips draw
  their text color from `color-mix(in oklab, <hue> 55%, var(--color-text))`
  (see `lib/tagColors.ts`); the raw hues fail AA outright in light
  mode.
- **Motion follows the OS**: one CSS kill switch (`app.css`) plus the
  JS gate (`lib/motion.ts`) collapse every animation and smooth
  scroll under `prefers-reduced-motion`. A new animation must go
  through one of the two gates.

## What automation cannot see

axe-core catches roughly 30-40% of WCAG. The rest is verified by
people, and the manual passes below are part of the standard -- run
them before releasing a version that changes interaction surfaces,
and record the date in the story's as-built notes.

### Setup

- **NVDA** (Windows, free): start NVDA, use Chrome. Browse mode reads
  the page (arrow keys); press `Insert+Space` to toggle focus mode
  when you want the app's single-key shortcuts to reach the page.
- **VoiceOver** (macOS, built in): start with `Cmd+F5`, use Safari or
  Chrome. The VO cursor (`Ctrl+Option+arrows`) browses; `Enter`
  interacts with the focused control.

### The checklist (both readers)

1. **Arrive**: load the app with a few tasks present. The title
   reads, and the skip link is the first stop (Tab once).
2. **Navigate the day list**: use the reader's next-element/list
   navigation to walk the day sections and task rows -- each row
   announces its text and completion state, sections announce their
   headings and counts.
3. **Add a task**: reach today's "New task text" input (Tab or the
   reader's form navigation), type, press Enter -- the new row is
   announced (it renders live) or at least reachable as the next
   element; the input keeps focus for the next entry.
4. **Complete a task**: focus a row's "Mark complete" button,
   activate it -- the state change is reflected (the checkbox's
   pressed state flips) and a completion toast is announced from the
   live region.
5. **Open search**: press `/` (focus mode) or Tab to the Search rail
   button and activate -- the dialog opens, focus is inside it, the
   "Search tasks" input announces itself.
6. **Focus stays trapped**: Tab through the whole dialog -- focus
   never escapes to the page behind.
7. **Esc restores**: press Escape -- the dialog closes and focus
   returns to the trigger you came from.
8. **Errors are heard**: open Settings, type an invalid timezone --
   the "Unknown timezone" alert is announced; force a failed save
   (stop the server) -- the error toast is announced.

Record: reader + version, OS, browser, date, pass/fail per item, and
any findings as issues in `plans/issues.md` (input for story work).

## Keyboard map for the audit

Every mouse action has a keyboard path; the audit trail from USE-9
lives in the user docs:
[docs/use/keyboard.md](../../use/keyboard.md). The drag handles and
the panel resize are the two deliberate pointer conveniences -- the
`r`/`m` inline editors and the `Ctrl`+`\` toggle are the keyboard
equivalents, and the Kanban card dates + blocked-by picker cover the
board.