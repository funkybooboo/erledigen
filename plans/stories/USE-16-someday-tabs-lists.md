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

ADR-011. Open question carried from the audit: the Someday area as
right-hand drawer vs its own modal -- explored before building the
tab chrome.