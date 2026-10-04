# ADR-011: Projects as Umbrellas: Gathered Views Over Tags, Not Containers

**Status**: Accepted (implements in v0.16.0)
**Date**: 2026-10-04

## Context

The v0.9.0 Projects modal shipped a Kanban board whose columns
(Ready / Scheduled / Done) derived from real task state (undated /
dated / completed). Dogfooding it immediately exposed the flaw:
those columns are not stages -- a scheduled task has no lifecycle
beyond done, so the board's horizontal axis means nothing once the
calendar takes over. Three design passes followed:

1. Kanban stages as task status (rejected: stale statuses, double
   bookkeeping between the board and the day list).
2. Two orthogonal axes per task -- stage AND date (rejected in the
   same conversation: "a day task gets completed that day; what would
   different stages even mean for it?").
3. Dropping projects entirely in favor of someday tabs/lists + tags
   (rejected: the umbrella need is real -- related tasks across days
   need a place to hang dates, progress, and milestone notes).

The fourth shape survived because it needs no new task-level fields:
the data model already speaks tags natively (`Task.tags`,
`RecurringTask.tags`, and `SomeDayGroup.tag` all exist).

## Decision

A project is a **higher-level abstraction that gathers related work
instead of containing it**: a named tag, clean metadata, and one
gathered view. Never a second home for tasks.

1. **The tag is the join key.** A project owns its tag; anything
   carrying it -- tasks, routines, someday lists -- is gathered into
   the project's view. No `projectId` field, no stage field, no
   membership table.
2. **Project = metadata + gathered view.** Name, description,
   start / due / completed dates, and a manual hill progress control
   (Basecamp-style: one user-dragged marker, no percentages, explicit
   "Mark complete" that stamps the completed date -- the user knows
   what done feels like; the app never guesses).
3. **The Projects modal is a lens**: Backlog (undated tasks grouped by
   their someday lists), Scheduled (dated tasks as a compact strip),
   Routines (with streaks), Done (count + recent), plus creation
   affordances that auto-apply the project tag.
4. **Auto-tab:** creating a project creates a Someday tab named for
   it; the project's lists live there. Plain lists carry no tag of
   their own; a project tab's lists inherit the project's tag -- the
   old someday-group `tag` field dies.
5. **Milestones in the day list** come from the project's dates
   ("X starts", "X due", "X completed"); an overdue due date keeps
   nagging on today until the project is marked complete.
6. **v0.9.0 removals** (recorded as a reversal in the v0.9.0 roadmap
   section): the Kanban board and derived columns, Activate and the
   active/inactive distinction (`isActive` drops from the schema), the
   dependency locks and blocked-by picker (`dependsOn` stays dormant
   in the model). No auto-distribute button ships; the pure planner
   stays dormant in shared code.

## Rationale

- Modals as lenses (rule 8 of ADR-010) is what prevents the drift
  that killed the v0.9.0 board: tasks live in exactly two homes (a day
  or a list), and every view reads.
- The two-world model from ADR-010 carries the kanban idiom where it
  is honest: someday lists (shelves) are the backlog surface; the
  date is the only bridge; scheduled tasks have no stages.
- Tag-gathering means projects and routines compose for free: a
  routine wearing the project tag has its generated instances gathered
  into the project home with zero new machinery.

## Consequences

### Positive

- Zero new task-level fields; every membership question is a tag
  query.
- The Projects modal, the Someday panel, and the day list can never
  disagree, because only one of them owns the work.
- Existing projects migrate trivially (their tasks already carry the
  tag; the lists absorb the metadata).

### Negative

- Supersedes freshly-shipped v0.9.0 work (board, activate, locks);
  the KanbanBoard component is removed in v0.16.0.
- Deleting a project no longer has task-deletion semantics to decide:
  deleting the umbrella leaves the work (the tasks keep the tag);
  that must be clearly communicated in the UI.

### Mitigations

- The reversal is recorded in both the v0.9.0 roadmap section and
  here, per the palette-removal precedent.
- Dormant code (`dependsOn`, `planProjectDistribution`) is documented
  as dormant rather than deleted, so a future reversal costs a slice
  instead of a rebuild.