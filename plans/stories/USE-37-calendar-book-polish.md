# USE-37: Calendar-book polish everywhere

As an app user, I want the whole app simpler, more minimal, more
idiomatic -- calendar-book vibes -- with every surface reviewed
against the design system, so that using erledigen feels like a good
paper object.

**Status**: planned
**Version**: v0.18.0

## Acceptance criteria
- [ ] Style pass across modals, panels, forms, interactions (no
      orphaned styles); Storybook review of every surface
- [ ] Settings restyled with the design system (post-v0.11.0 it holds
      only behavior)
- [ ] The `/` command palette removed entirely: `{mod}+K` stays a
      plain task search; keyboard shortcuts stay; NL parsing stays
      (the inline inputs and the Routines modal use it independently)
- [ ] Transparency principle holds: no hidden machinery; the app
      shows what it is doing
- [ ] The remaining UX-audit findings shipped or closed with a
      recorded decision

## Notes

The 2026-10-03 audit's verdict: right direction, needs polish to a
gold standard. Palette removal touches the Search modal, command
registry, Help modal, e2e coverage.