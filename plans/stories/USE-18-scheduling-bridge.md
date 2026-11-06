# USE-18: The scheduling bridge between the two worlds

As an app user, I want to move work between the backlog world and
the calendar world by setting or clearing a date, so that scheduling
is one gesture and the task always lives in exactly one world.

**Status**: done (v0.16.0)
**Version**: v0.16.0

## Acceptance criteria
- [x] Dragging a parked task onto a day section (or setting a date)
      makes it a day task wearing the project chip
- [x] Clearing the date returns it to its list
- [x] A scheduled task has no lifecycle beyond done (no stages, no
      board)

## Notes

ADR-011: the date is the only bridge (system rule 2). The v0.9.0
Kanban board, activate/deactivate, and dependency locks are REMOVED
with this build -- `dependsOn` stays dormant in the model, and
`planProjectDistribution` stays dormant in shared.

As built (v0.16.0):

- The bridge round trip is the drag plumbing the day list already
  had: a parked member dragged onto a day keeps its `somedayListId`
  while it lives there (the date wins; the list is remembered), so
  clearing the date -- dragging it back -- returns it to its list.
  The project chip rides along (tags do not change when moving).
  Pinned by the e2e scheduling-bridge round-trip test.
- Removed: `KanbanBoard` + stories + `kanban.spec.ts`; `isActive`
  end to end (migration 014 `DROP COLUMN`, activate/deactivate
  endpoints, `?active` filter, `ProjectService`, the modal's
  active/inactive split, the snapshot model -- v1 documents
  carrying it restore fine, tolerated and ignored); `dependsOn`
  from the public update API and the blocked-by picker; the CSV
  view's always-null `dependsOn` column.
- Dormant and kept, as the ADR records: `dependsOn` in the
  model/storage/restore path; `planProjectDistribution` in shared
  with its unit tests. A future reversal costs a slice, not a
  rebuild.
- Deleting a project now says so in the confirm: the tasks are not
  deleted, they keep the project tag (the umbrella consequence).
