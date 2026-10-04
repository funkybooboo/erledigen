# ADR-014: Deliberate Scope Boundaries: What Erledigen Is Not

**Status**: Accepted
**Date**: 2026-10-04

## Context

The 2026-10-04 whole-app coherence pass tested adjacent concepts
against the product identity (ADR-010) by one question: "would a
paper calendar have it, and does automation improve it?" Several
familiar product features failed that test. Recording the verdicts
prevents future relitigation -- each of these is tempting enough that
someone (including us) will propose them again without the context of
why they were declined.

## Decision

1. **No hour-grid calendar view (v0.14.0 deferred).** An hour grid is
   Google Calendar's shape, not a calendar book's. Time-awareness
   ships where the user lives instead: times on tasks + arrival
   insertion by time (ADR-013), "# Morning"-style sections, the
   Calendar modal's month-density overview, and `.ics` import as the
   bridge to external calendaring. A grid is revisited only if lived
   experience demands minute-precision scheduling after v0.17.0.

2. **People are tags, not entities.** A paper family calendar says
   "Mom -- dentist 3pm": a person is an adjective on a line, not a
   structure. People entities need identity, ownership, and
   permissions -- none of which exist before authentication (planned
   v2.3.0). "For Sam" work is a tag: filterable, colorable, zero new
   machinery. A `person:` tag-kind may be added later for color
   semantics; full people support joins the multi-user work post-auth.

3. **No documents subsystem.** Folders, titles, and cross-links are a
   second product (and a crowded one). A parked someday task with a
   long live-markdown note IS a document; a "Reference" tab of parked
   tasks is a personal wiki built entirely from existing nouns. Notes
   exist only attached to a task or a day (v0.10.0's day notes being
   the paper calendar's margin), and the Notes modal is a pure lens
   over them -- never a creation surface for standalone notes.

4. **Modals are lenses, not queues.** Concretely: the planned
   Notification modal surfaces what happened and what the app is
   doing; it must never become a second inbox the user is obligated
   to clear.

## Rationale

- Every exclusion passed the same test: it either duplicates a
  surface that already exists (the day list, external calendars,
  dedicated note apps) or it imports a data model (identity, folders,
  queues) whose maintenance cost lands on a single-user, self-hosted,
  privacy-first product.
- Saying no explicitly is cheaper than an implicit yes via feature
  creep; each of these four has shipped in real task apps and caused
  real complexity there.

## Consequences

### Positive

- The roadmap's future versions stay focused on depth (projects,
  routines, polish) instead of breadth.
- Contributors get the counter-argument on file when tempted to
  scope these.

### Negative

- Users who want a real time grid or rich docs must pair Erledigen
  with another tool (which the `.ics` bridge and lossless JSON export
  make easy).
- A person is "just a tag", so niceties like per-person views or
  sharing do not exist pre-auth.

### Mitigations

- v0.14.0 is deferred with a revisit clause, not deleted -- the
  roadmap section carries the full rationale.
- Every boundary here is revisitable by a new ADR that supersedes
  this one with evidence; none is dogma.