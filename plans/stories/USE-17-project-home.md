# USE-17: The project home gathers its work

As an app user, I want a project modal that gathers everything
carrying the project's tag (backlog by list, scheduled by day,
routines, done), so that one view shows the whole project without
moving any task.

**Status**: done (v0.16.0)
**Version**: v0.16.0

## Acceptance criteria
- [x] Gathered view: Backlog (undated tasks grouped by their someday
      lists), Scheduled (dated tasks grouped by day), Routines (with
      streaks), Done (count + recent)
- [x] Metadata row: start/due/completed dates + the hill progress
      control + explicit "Mark complete" (stamps completedAt; progress
      never auto-triggers)
- [x] Create from the project: "+ add task" / "+ add habit" /
      "+ add list", every path auto-applying the project tag (the tag
      IS the linking mechanism)
- [x] Cross-links: someday lists, habits, and day tasks show the
      project chip and hop to the project home

## Notes

ADR-011: the tag is the join key; a project gathers, never contains.
The hill: one marker the user drags -- uphill = figuring it out, top
= scope settled, downhill = executing. No percentages.

As built (v0.16.0):

- The gathered view is a pure derivation (`projectHome.ts` +
  unit tests): Backlog groups by Someday list (lists by panel
  position, Unlisted last), Scheduled groups by day, Routines carry
  their current streak, Done shows the count plus the ten most
  recent completions. Sub-tasks glue under their parents, tag or
  no tag. The home renders real TaskRows (drag disabled), so
  members are completable/editable in place.
- The hill is `HillProgress` -- an SVG curve with a range input
  overlaid, so the keyboard path comes free -- and the only reading
  is the phase caption; no percentage is ever displayed. Mark
  complete stamps `completedAt` explicitly; Reopen clears it.
  `hillPosition` (0-100) is a new additive Project field (migration
  015); nothing moves it but the user.
- "+ add task" / "+ add habit" is ONE grammar input (rule 3: one
  grammar in every input): a trailing routine phrase makes the
  habit. The project tag is appended to the text; the habit path of
  `createFromText` now extracts `#tags` (an old audit gap), so
  habits can wear project tags. New members park in the project
  tab's first list, Unlisted if it has none; "+ add list" shelves a
  list under the project's tab (repairing a missing auto-tab after
  a restore).
- Cross-links: project tag chips on day-task rows and habit rows,
  and the project chip beside lists under a project tab, hop
  straight to the project home (`uiStore.openModal` gained
  params). The chips are buttons with accessible names; nothing
  else about the rows changes.
