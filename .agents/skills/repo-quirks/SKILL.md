---
name: repo-quirks
description: Erledigen domain and architecture facts that surprise agents -- priority and projects are TAGS not fields, task dates are local yyyy-MM-dd key strings and null means Someday, habits materialize idempotently as real tasks with no server scheduler, WS events skip the originator on TWO layers, literal routes must register before :id, zod schemas self-register into OpenAPI, hidden CI gates (512KB bundle, todo-to-issue). Use before touching the domain model, API routes, stores, or trusting doc claims.
---

# Repo Quirks

Verified facts that are easy to get wrong.

## The tag system IS the domain model

- Priority is NOT a field: `p1`/`p2`/`p3` are tags resolved through the
  tag-kind system (`shared/src/utils/tagKinds.ts`, DEFAULT_TAG_KIND_MAP).
  Projects own a `project:`-prefixed tag kind. Free-form tags are the
  organizing mechanism across tasks, groups, Someday, and filters.
- Keyboard 1/2/3/0 toggle those priority tags; deadline semantics live in
  `hasDeadlineTag`, not a boolean.

## Dates

- A task's `date` is a local `yyyy-MM-dd` key string; `date === null` means
  Someday. All date math goes through dateProvider key helpers
  (splitKey/addDaysToKey/daysBetween in shared's NativeDateProvider) --
  never Date-object arithmetic (a timezone bug shipped once from that).

## Habits (recurring tasks)

- A habit template materializes REAL task instances stamped with
  `recurringTaskId` and the template's startTime. Generation is IDEMPOTENT:
  existing instance dates are skipped (TaskRepository
  findByRecurringTaskId). Editing a schedule intentionally does NOT
  regenerate already-created instances.
- The CLIENT drives generation on demand: DayList chunk-loads fire
  generate-all for the new range; inline-created habits generate a +90-day
  horizon (GENERATE_HORIZON_DAYS). There is NO server-side job queue or
  scheduler, despite ADRs discussing one.
- Natural language: `shared/src/utils/parseRecurrence.ts` only detects a
  TRAILING recurrence phrase (TeuxDeux-style). Unparsable text silently
  becomes a normal task (returns null). Weekday-only and weekend-only
  schedules are unsupported by the schema and parse as normal tasks.

## Events / realtime: double origin-skip

- Every mutation publishes a domain event on the EventBus carrying the
  requester's x-client-id. The server broadcast SKIPS the originator's
  socket, AND client websocketService ALSO ignores messages whose
  originClientId matches its own id. Two layers on purpose -- do not remove
  one "because the other covers it".
- Client stores UPSERT by id on ingest so an echoed event cannot duplicate
  rows in keyed each-blocks.

## HTTP surface

- Literal sub-paths must be registered BEFORE `:id` routes (purge,
  generate-all) or the literal is parsed as the id.
- Zod schemas self-register into the OpenAPI registry on import
  (zod-to-openapi): a schema referenced only by tests still shows up in
  /openapi.json. The document is assembled in openapi/registry.ts + spec.ts.
- `projects.tag` is UNIQUE in sqlite but not in-memory: POST /api/projects
  with an existing tag 500s only on sqlite.

## Docs vs reality, and hidden gates

- Docs deliberately mark unimplemented ideas as "planned": metrics, job
  queue, structured logging, richer observability are ADRs/prose, NOT code.
  Trust code over prose; verify a claimed feature exists before relying on
  it or extending it.
- Easy-to-miss CI gates: client bundle must stay under 512KB; Storybook
  build must succeed; TODO/FIXME/BUG/HACK comments pushed to main
  auto-open GitHub issues (todo-issues.yml).