# ADR-009: Import Semantics -- Destructive Restore and Additive Imports

**Status**: Accepted
**Date**: 2026-09-07

## Context

The v0.7.0 roadmap calls for import from five sources -- JSON (restore
from a previous export), generic CSV, iCal, Todoist CSV, and Things 3
JSON -- plus the Settings import UI. ADR-008 already pinned the export
side: the JSON export is the canonical, lossless backup (trash
included) and must be trustworthy to restore "years after it was
written".

Two semantics were on the table for the JSON path:

1. **Destructive restore**: the snapshot replaces every application
   table, verbatim (ids, timestamps, trash, preferences).
2. **Merge by upsert-by-id**: rows in the snapshot overwrite live rows
   with the same id; live rows not in the snapshot survive.

The four foreign formats carry no Erledigen ids at all, so only the
JSON path is affected by the decision; they import additively by
nature.

## Decision

1. **JSON import is a destructive restore.** `POST
   /api/import?format=json` validates a version-1 `ExportSnapshot`
   strictly (any bad row rejects the whole import with 400), writes a
   pre-restore backup file next to the database
   (`erledigen-pre-restore-<timestamp>.json`), and then replaces every
   application table -- `tasks`, `some_day_groups`, `projects`,
   `recurring_tasks`, `user_preferences` -- inside ONE transaction.
   Migrations and the job queue are application infrastructure, not
   application data: a restore never touches them.

2. **Upsert-by-id is rejected.** Erledigen ids are sequential integers
   generated per table (`MAX+1` in SQLite, a counter in memory). They
   are only meaningful within one database's lineage: a snapshot id `5`
   and a live id `5` are almost certainly different rows. Merging a
   foreign backup by id would silently overwrite unrelated live tasks
   -- the exact data loss a backup feature must never cause. Id reuse
   after trash purges means it can even misfire on the same instance.

3. **All other formats are additive imports.** Every parsed row becomes
   a new task with a new server id; existing data is never touched.
   Row-level problems (an unparseable date, an over-long text) skip the
   row with a warning in the response, not a failure: a migration tool
   that stops half-way on one bad row is worse than one that reports
   what it skipped.

4. **Source states map to Erledigen's model, not away from it.**
   Things 3 `canceled` to-dos import into the trash (created, then
   soft-deleted) -- Erledigen's equivalent of a canceled bucket:
   kept, out of the active lists, restorable. Things deadlines have no
   field, so they move into the notes (`Deadline: <date>`) instead of
   being dropped. Todoist INDENT nesting and Things checklists become
   parent/child tasks. Recurring events (RRULE) and recurring/relative
   Todoist dates import as their first occurrence / undated, with a
   warning -- recurrence mapping is deliberately out of scope.

5. **Restore atomicity is storage-specific.** bun:sqlite transactions
   are synchronous; an `await`ed repository write inside a transaction
   callback resolves only after the transaction has committed. The
   repos' restore write paths therefore expose synchronous cores
   (`replaceAllSync`/`restoreSync`), composed by a
   `SnapshotRestoreWriter` port: one SQLite transaction for the file-
   backed adapter, sequential writes for the in-memory adapter. A
   mid-restore failure rolls every table back (pinned by a test).

6. **A restore broadcasts `data:restored`.** Per-row events cannot
   describe a wholesale replace: connected clients refetch everything
   when they receive it. The restoring client is skipped by its own
   event (the realtime double-skip) and refetches from the HTTP
   response instead. Additive imports broadcast the existing per-row
   `task:created`/`task:deleted` events, consistent with the realtime
   model.

7. **The API mirrors the export endpoint.** The request body is the
   raw source document (`curl --data-binary @backup.json ...` -- what
   you download is what you can upload); the RESPONSE is the standard
   `{ data: ImportResult }` envelope with counts and warnings. Generic
   CSV column mapping travels as `field:columnIndex` pairs in the query
   (`mapping=text:0,date:2`) -- index-based, so header names containing
   commas or colons cannot break it; without a mapping, columns are
   auto-detected from common header names (including Erledigen's own
   CSV export).

## Rationale

- The roadmap's wording ("restore from a previous export") and
  ADR-008's lossless promise both mean replace semantics: a restore
  that finds yesterday's deletions still there is not lossless.
- The id scheme makes upsert-by-id unsafe, not just unergonomic; merge
  is not a "mode we should have built" but a different feature. If
  combining two instances' data is ever wanted, the honest
  implementation is additive-with-id-remapping (a new mode, not
  upsert); nothing in the roadmap asks for it.
- The pre-restore backup turns the scariest UX moment ("replace
  everything") into a reversible action, at the cost of one file.
- Additive imports skip-and-report rather than all-or-nothing because
  the user keeps both sides: the source file AND the live instance.
  Losing 3 bad rows with a report beats losing all 300 good ones.

## Consequences

### Positive

- The ADR-008 backup contract closes: export -> file -> import is a
  full round-trip with the trash and preferences intact.
- Foreign imports are idempotent-safe: rerunning adds rows (visible,
  obvious) rather than corrupting ids.
- A restore is atomic on SQLite; even a full-disk failure mid-restore
  leaves the previous state in place, and the pre-restore backup file
  guards the rest.

### Negative

- A restore drops everything created since the backup -- by design,
  but the UI must say so (it does, in the confirmation dialog).
- Canceled/duplicate imports accumulate rows; the trash and the
  delete affordances absorb them.
- The synchronous write cores (`replaceAllSync`) are a bun:sqlite
  constraint leaking one level into the repository APIs (documented
  at each site, composed only by the restore writer).

### Mitigations

- The confirmation dialog states the replace scope explicitly; the
  pre-restore backup is reported in the response (`backupPath`).
- Row-level warnings are capped server-side (100) and 5 shown in the
  UI with a "... and N more" tail.
- Version-gate: a snapshot with `version !== 1` is rejected with a
  clear message; when version 2 exists, the restore path must accept
  every released version (per ADR-008's stability rule).