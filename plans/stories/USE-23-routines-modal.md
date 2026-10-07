# USE-23: The Routines modal

As an app user, I want a rebuilt Routines modal -- orderable cards,
NL-first creation, a detail view with the heatmap and trimmed stats --
so that managing every repeat in my life is one calm screen.

**Status**: planned
**Version**: v0.17.0

## Acceptance criteria
- [ ] Orderable list of routine cards (drag sets the routine order):
      name, canonical schedule, streak, paused/ended state
- [ ] NL-first creation with the blend form (USE-22)
- [ ] Detail: heatmap, trimmed stats (no instance count, no empty
      stats for fresh routines), until field, pause/resume (generation
      stops; instances stay real tasks), editable start date
      (affects future generation only), richer monthly rules
- [ ] Per-occurrence edits made obvious: instances are real tasks;
      changing one day never touches the template
- [ ] Delete keeps past completed instances and removes the rest

## Notes

Absorbs the UX-audit habits findings: trimmed stats, obvious
per-occurrence edits, delete semantics.