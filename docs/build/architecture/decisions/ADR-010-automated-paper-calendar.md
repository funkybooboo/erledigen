# ADR-010: The Automated Paper Calendar: Product Identity and System Rules

**Status**: Accepted
**Date**: 2026-10-04

## Context

Between 2026-10-03 and 2026-10-04 the project went through a UX audit,
a v0.9.0 release, and three deep design conversations (projects, habits,
and a whole-app coherence pass). Each conversation started from a
familiar shape -- a kanban board, continuous sorting, an hour-grid
calendar -- and each converged on the same realization: those shapes
belong to other products. A scheduled task has no stages beyond done;
a board over real task state cannot mean anything; an hour grid is
Google Calendar's shape, not a calendar book's.

What kept emerging instead was one coherent identity, and it needed
to be written down once, as a contract every future feature is
checked against -- or the next design conversation would relitigate
it from scratch.

## Decision

Erledigen is an **automated paper calendar**: a day list you write by
hand, plus an engine that fills in everything that recurs, and that
never moves your handwriting.

Every feature obeys these rules:

1. One home per task -- a day or a someday list, never a modal.
2. The date is the only bridge between the two worlds.
3. One grammar in every input: text first, then qualifiers (`#tags`,
   a date phrase, a routine phrase, times).
4. Typed words and manual controls can never disagree.
5. Arrivals are placed once (routine order, time, or the bottom);
   after that, manual order is sovereign -- nothing reorders
   continuously, and continuous sort modes do not exist.
6. In-day sections are tasks whose text is a heading ("# Morning").
7. Tags are the only join key: priority, project, routine, or
   free-form -- someday lists carry no tags of their own.
8. Umbrellas read, never move: projects, holidays, stats, and the
   notes view are lenses over work that lives on days or in lists.
9. Routine instances are real tasks; generation is idempotent and
   history is immutable -- schedule edits reshape the future only.
10. One noun per concept, used everywhere.
11. Automation never rewrites handwriting: it materializes, places
    arrivals, and derives displays -- nothing else.

## Rationale

- The two-world split (backlog lists vs. calendar days) is what makes
  the kanban idiom true where it is true -- for UNPLANNED work -- and
  what dissolves the stage-vs-day contradiction: a "stage" is not a
  status a task carries; it is a shelf where work waits before it is
  given a day.
- Rule 5 is the classic lesson of todo apps that reorder themselves:
  users stop trusting a surface that moves rows under them. Automation
  that only positions arrivals never violates trust.
- Rule 7 keeps the domain model flat: every membership question becomes
  a tag query, and no feature needs a join table.
- Rule 11 is the identity's test clause. The paper calendar never
  rewrites what you wrote; automation fills in the pre-printed parts
  (recurrences, rollover) and derives read-only views (banners,
  stats, gathered project homes).

## Consequences

### Positive

- Design conversations now have a checklist: new proposals are tested
  against the rules before they are scoped.
- The roadmap carries the same rules as the architecture docs, so
  plans and code cannot drift apart silently.
- Features compose: the tag join key means projects gather routines,
  tasks, and lists with zero new machinery (ADR-011).

### Negative

- Some familiar mechanisms are excluded by contract: continuous sort
  modes (the shipped priority sort is retired in v0.17.0), kanban
  boards over task state (the shipped v0.9.0 board is superseded by
  ADR-011), and hour-grid time-blocking (v0.14.0 deferred).
- "Automation never rewrites" forbids convenient features like
  auto-tidying a day's order.

### Mitigations

- Retirements are recorded as versioned reversals in the roadmap (the
  v0.9.0 and v0.6.0 sections carry reversal notes), so history stays
  honest.
- Where automation is missed (spreading a backlog across a date
  range), the pure planner stays dormant in shared code and can return
  as an explicit, user-invoked action -- invocations never violate
  rule 11.