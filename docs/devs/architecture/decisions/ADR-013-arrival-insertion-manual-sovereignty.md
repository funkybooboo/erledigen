# ADR-013: Day-List Ordering: Arrival Insertion and Manual Sovereignty

**Status**: Accepted (implements in v0.17.0)
**Date**: 2026-10-04

## Context

Ordering in the day list has been manual-first since v0.6.0 (drag
rewrites dense positions), with a priority sort mode bolted on as a
continuous reorder. Two 2026-10-04 findings forced the question:

1. Dogfooding: "I want to be able to order my habits in the habit
   modal and have them reorder themselves on the daily task lists";
   and timed tasks should slot by time when created.
2. The coherence pass: a continuous sort is automation that rewrites
   handwriting -- exactly what the product identity (ADR-010, rule
   11) forbids. The shipped priority sort mode is the odd mechanism
   out: it reshuffles everything, forever, the moment it is on.

The design question was where "automated ordering" fits in a system
whose core promise is that the engine never moves what you wrote.

## Decision

**Automated insertion, manual sovereignty.** Automation positions
ARRIVALS -- never existing rows.

1. **Arrival placement, once:** when a task arrives on a day
   (created, scheduled, or generated), it receives an initial
   position:
   - a fresh routine instance lands per the routine order set in the
     Routines modal (relative to the day's other routine instances);
   - a task created with a time slots in by time among that day's
     timed tasks;
   - everything else lands at the bottom.
2. **Manual wins and sticks:** once a row is dragged, that day's
   placement belongs to the user. Automation never touches placed
   rows, and nothing reorders continuously.
3. **Continuous sort modes do not exist.** The priority sort mode is
   retired (a v0.6.0 reversal, recorded in the roadmap); p1/p2/p3
   remain colored tags, nothing more.
4. **In-day sections are tasks:** a task whose text starts with
   `# ` (e.g. "# Morning") renders as a section header, carries its
   own inline add beneath it, and participates in the same one manual
   sequence -- a task belongs to the section above it by position.
   Tags are `#word` with no space, so a heading can never collide
   with tagging; the syntax is shared with the v0.10.0 live-markdown
   title model.

## Rationale

- The paper-calendar test (ADR-010): a book never reshuffles your
  lines; it does print next week's recurring items in the same slots
  as last week's. Arrival placement IS the pre-printed part; drag IS
  the handwriting.
- One-time placement gives the user full automation value (a fresh day
  greets you in a sensible order) with zero trust cost (it never
  surprises you afterwards).
- Sections-as-tasks means grouping needs no schema, no entity, and no
  second ordering system -- it is rows in a sequence, the same as
  everything else.

## Consequences

### Positive

- The day list can never "move things on its own" -- the classic todo
  app trust failure is excluded by design.
- Routine order (Routines modal drag) and task times gain real
  ordering power without any sort-mode UI.
- The Filter modal sheds the sort option; filtering and ordering
  become orthogonal (filters change WHAT renders, not WHERE).

### Negative

- The priority sort mode is removed; users who relied on it lose the
  lens (mitigated: priorities remain visible as colored tags, and
  arrival placement respects nothing but routine order/time/bottom).
- "Sort today by X" one-off views are not available even on demand
  (a temporary lens would be compatible with rule 11, but none is
  planned).

### Mitigations

- The retirement is recorded in the v0.6.0-era roadmap history and
  shipped as an explicit v0.17.0 removal with e2e updates.
- If a temporary one-shot sort lens is wanted later, it can be added
  as a view that never writes positions -- compliant with ADR-010
  rule 11 by construction.