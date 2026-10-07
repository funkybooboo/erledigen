# USE-18: The scheduling bridge between the two worlds

As an app user, I want to move work between the backlog world and the
calendar world by setting or clearing a date, so that scheduling is
one gesture and the task always lives in exactly one world.

**Status**: planned
**Version**: v0.16.0

## Acceptance criteria
- [ ] Dragging a parked task onto a day section (or setting a date)
      makes it a day task wearing the project chip
- [ ] Clearing the date returns it to its list
- [ ] A scheduled task has no lifecycle beyond done (no stages, no
      board)

## Notes

ADR-011: the date is the only bridge (system rule 2). The v0.9.0
Kanban board, activate/deactivate, and dependency locks are REMOVED
with this build -- `dependsOn` stays dormant in the model, and
`planProjectDistribution` stays dormant in shared.