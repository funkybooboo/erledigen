# USE-17: The project home gathers its work

As an app user, I want a project modal that gathers everything
carrying the project's tag (backlog by list, scheduled by day,
routines, done), so that one view shows the whole project without
moving any task.

**Status**: planned
**Version**: v0.16.0

## Acceptance criteria
- [ ] Gathered view: Backlog (undated tasks grouped by their someday
      lists), Scheduled (dated tasks grouped by day), Routines (with
      streaks), Done (count + recent)
- [ ] Metadata row: start/due/completed dates + the hill progress
      control + explicit "Mark complete" (stamps completedAt; progress
      never auto-triggers)
- [ ] Create from the project: "+ add task" / "+ add habit" /
      "+ add list", every path auto-applying the project tag (the tag
      IS the linking mechanism)
- [ ] Cross-links: someday lists, habits, and day tasks show the
      project chip and hop to the project home

## Notes

ADR-011: the tag is the join key; a project gathers, never contains.
The hill: one marker the user drags -- uphill = figuring it out, top
= scope settled, downhill = executing. No percentages.