# USE-9: Every action reachable without a mouse

As an app user who lives on the keyboard, I want every action
reachable without a mouse, so that the day list never forces a
pointer detour.

**Status**: planned
**Version**: v0.12.0

## Acceptance criteria
- [ ] Audit confirms no mouse-only interactions remain
- [ ] The single shortcut registry (keybindings.ts) stays the source;
      help + tooltips derive from it

## Notes

Keyboard-first is a product pillar. The `/` command palette is
separately retired in the v0.18.0 polish pass; shortcuts themselves
never go.
