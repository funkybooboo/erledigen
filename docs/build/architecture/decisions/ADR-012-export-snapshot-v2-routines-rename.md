# ADR-012: Export Snapshot Version 2: The Routines Rename

**Status**: Accepted (implements in v0.17.0)
**Date**: 2026-10-04

## Context

The habits feature has lived under two names since v0.2.0: the UI and
users say "habits", while the code, API, and storage say "recurring
tasks" (`RecurringTask`, `/api/recurring-tasks`, `recurringTaskId`,
`recurring_tasks`). Dogfooding confirmed the split is a real source of
confusion, and the 2026-10-04 design conversation settled on one word
for the concept everywhere: **routines** -- it fits the until semantics
(a routine ends) and the project umbrella (projects gather routines).

ADR-008 made the export snapshot the stable, versioned backup format:
"removing or retyping a field bumps `version` to 2, and the future
import path must then accept every released version." A full rename is
exactly that case: `recurringTasks` -> `routines` and
`recurringTaskId` -> `routineId` are retyped snapshot fields, so the
rename invokes ADR-008's version-2 clause.

## Decision

1. **One noun end to end, in one deliberate breaking pass.** The
   entity becomes `Routine`; API routes become `/api/routines`
   (including adopt, generate, generate-all, stats); the task field
   becomes `routineId`; the WS event becomes `routine:generated`; the
   Habits modal becomes the Routines modal; "Make recurring" becomes
   "Make routine". Storage follows: `recurring_tasks` -> `routines`,
   `recurring_task_stats` -> `routine_stats`,
   `tasks.recurring_task_id` -> `tasks.routine_id`.
2. **The export snapshot bumps to `version: 2`**, renaming
   `recurringTasks` -> `routines` and `recurringTaskId` ->
   `routineId`. Per ADR-008, exports are written years before they
   are read: the restore path accepts BOTH v1 and v2 -- a v1 snapshot
   (with `recurringTasks`) restores verbatim onto the renamed model.
3. **New snapshots are written as v2 only.** The version is not
   negotiable per document; the writer always emits the current
   schema, and the reader maps every known older shape forward.
4. The pass happens pre-1.0, while the app has a single user and no
   external API consumers -- the cheap window for breaking changes.

## Rationale

- A rename that stops at the UI preserves the exact confusion it
  exists to fix; half-renames are how codebases grow two vocabularies.
- ADR-008 already priced this: the version-2 clause exists precisely
  so renames are possible without breaking old backups.
- Doing it in one pass avoids a long tail of aliases
  (`/api/recurring-tasks` and `/api/routines` coexisting "temporarily"
  is how "temporarily" becomes permanent).

## Consequences

### Positive

- One word for the concept in the codebase, the API, the storage, the
  UI, the tests, and the docs -- including the user docs and Bruno
  collection, which rename with it.
- ADR-008's stability promise survives its first real invocation,
  exercising the both-version restore path (v1 holiday-era snapshots
  keep restoring).

### Negative

- Breaking API change: every route, field, WS event, table, test
  fixture, and Bruno file touches at once; the diff is large by
  construction.
- Every existing JSON backup in the wild is a v1 document; the restore
  path carries the v1 mapping indefinitely.

### Mitigations

- The restore path's both-version acceptance is contract-tested in
  the import adapter suite (v1 fixtures from before the rename).
- The single breaking pass lands in v0.17.0, gated by the full CI
  mirror (api, e2e, Bruno) so nothing half-renamed can merge.