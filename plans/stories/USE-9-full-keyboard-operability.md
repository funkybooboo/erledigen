# USE-9: Every action reachable without a mouse

As an app user who lives on the keyboard, I want every action
reachable without a mouse, so that the day list never forces a
pointer detour.

**Status**: done
**Version**: v0.12.0

## Acceptance criteria
- [x] Audit confirms no mouse-only interactions remain
- [x] The single shortcut registry (keybindings.ts) stays the source;
      help + tooltips derive from it

## Notes

Keyboard-first is a product pillar. The `/` command palette is
separately retired in the v0.18.0 polish pass; shortcuts themselves
never go.

As-built (2026-10-09, PR #71): the audit walked every surface.
Hover-only actions (row actions, Someday group actions, sub-task
delete) reveal on `:focus-within` -- nothing operable is invisible.
Project cards are real buttons instead of `role="button"` divs with
buttons inside (axe nested-interactive). Calendar day cells carry
full-date labels + `aria-current`. The Someday groups container is
the `role="list"` its list items required. Modal bodies are keyboard
focus stops, and stacked dialogs get unique title ids. The two
deliberate pointer conveniences (drag grips, panel resize) keep
their keyboard equivalents (`r`/`m` editors, `Ctrl`+`\` toggle) --
the flows are documented for users in docs/use/keyboard.md. A
minimap `scrollIntoView` side effect (Chrome's sequential focus
starting point) that hijacked the first Tab after load was found
and fixed during USE-10 work. The registry criterion is unchanged
since v0.11.0 (one resolution feeds matcher, help, tooltips) and
was verified, not rebuilt.