# ADR-026: Export Snapshot Version 2: The Someday/Projects Restructure (extends ADR-008, resequences ADR-012)

**Status:** Accepted (implements in v0.16.0)
**Date:** 2026-11-06

## Context

ADR-011 (Projects as Umbrellas, v0.16.0) removes and retypes export
snapshot fields: the Someday restructure (USE-16) replaces
`someDayGroups` with tabs and lists and renames the task field
`someDayGroupId` -> `somedayListId`; the v0.9.0 reversal (USE-18)
removes `Project.isActive` from the schema. ADR-008 priced exactly
this case: removing or retyping a snapshot field bumps `version`, and
the restore path must then accept every released version.

ADR-012 (the v0.17.0 routines rename) already claimed `version: 2`
for its field renames. Two consecutive breaking releases cannot both
take version 2 -- "exports are written years before they are read"
only stays honest if each released version number maps to exactly one
snapshot shape.

## Decision

1. **v0.16.0 bumps the export snapshot to `version: 2`.** The writer
   always emits the current shape; v2 is defined by what the v0.16.0
   release ships:
   - `someDayGroups` is REPLACED by `somedayTabs` (`SomedayTab[]`)
     and `somedayLists` (`SomedayList[]`) -- plain lists carry no tag
     of their own; a project tab carries the project's tag.
   - `Task.someDayGroupId` is renamed to `somedayListId`.
   - `Project.isActive` is removed (ADR-011's v0.9.0 reversal).
   - `Project` gains the hill marker field (additive within v2).
2. **The restore path accepts v1 and v2.** A v1 snapshot maps
   forward: `somedayGroups` become lists under one default tab (ids
   preserved, group `tag`s dropped), `someDayGroupId` reads as
   `somedayListId`, and `isActive` is ignored.
3. **ADR-012's routines rename moves from snapshot v2 to v3**
   (superseding ADR-012 clause 2 only). Its v0.17.0 restore path
   accepts every released version: v1, v2, and v3.

## Rationale

- The version number names a released shape; sequencing follows
  release order, and v0.16.0 ships first.
- Both invocations exercise the same ADR-008 clause, one version at a
  time -- the both-version restore path is proven twice before 1.0,
  while the app has a single user and no external consumers.
- Renaming the task field with the someday restructure (rather than
  shipping v2 with both spellings) keeps rule 10: one noun per
  concept.

## Consequences

### Positive

- Each released version number maps to exactly one snapshot shape.
- The someday restructure and the routines rename stay independent
  breaking passes (pre-1.0's one deliberate pass per concept), each
  with its own restore tests.

### Negative

- ADR-012's clause numbering no longer matches the version it takes;
  ADR-026 records the supersession so the mismatch is not silent.
- The import adapter carries a v1->v2 mapping layer alongside the
  entity-version fallbacks (the pre-holidays and pre-day-notes
  optional-key rules) -- one more code path the export/import
  contract suites must pin.

### Mitigations

- Export and import fixtures assert both shapes round-trip: a v1
  fixture restores onto the v0.16.0 model; a freshly written v2
  snapshot restores verbatim.
- The mapping layer is additive to the existing per-entity
  optional-key machinery, not a parallel system.
