# USE-16: Someday becomes tabs and lists

As an app user, I want the Someday panel to hold tabs of lists, so
that my unscheduled ideas park in named places that are not tied to
dates.

**Status**: planned
**Version**: v0.16.0

## Acceptance criteria
- [ ] Tabs hold lists (replacing tag-based groups); default: one
      tab + one list, both "Someday", no title shown
- [ ] Lists are not tied to a date; tasks parked in them are undated
      backlog
- [ ] Auto-tab: creating a project creates its someday tab with
      "+ add list" ready
- [ ] Plain lists carry no tag of their own; a project tab's lists
      inherit the project's tag (the someday-group tag field dies)
- [ ] Sub-tasks nest under their parents in the new surfaces too
- [ ] The panel keeps its name: the Someday panel

## Notes

ADR-011. The drawer-vs-modal question is settled (2026-11-06,
the user's call): the Someday area stays the right-hand drawer --
tabs run across the top of the panel, lists nest under them. A modal
would bury the capture net behind a keystroke and would put the
task's one home (rule 1) inside a lens. The export snapshot carries
the restructure as version 2 (ADR-026).