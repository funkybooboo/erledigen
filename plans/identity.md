# Identity: the product constitution

Every story, feature, and fix serves one of the three roles (ADR-017)
and obeys these rules. They are immutable -- a rule change is a new
ADR that supersedes ADR-010, not an edit here.

## The identity

Erledigen is an **automated paper calendar** -- a day list you write
by hand, plus an engine that fills in everything that recurs and never
moves your handwriting. Recorded as
[ADR-010](../docs/devs/architecture/decisions/ADR-010-automated-paper-calendar.md);
the adjacent-concept verdicts (no time grid, people as tags, no docs
subsystem, modals as lenses) are
[ADR-014](../docs/devs/architecture/decisions/ADR-014-scope-boundaries.md).
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

---
