# USE-26: Arrivals placed once, then my order is sovereign

As an app user, I want fresh tasks and routine instances to arrive in a
sensible position (routine order, time, or the bottom) and to then stay
exactly where I put them, so that nothing ever reorders my day behind
my back.

**Status**: planned
**Version**: v0.17.0

## Acceptance criteria
- [ ] Routine order drives arrival order of fresh instances on a day
- [ ] A task created with a time slots in by time among the day's
      timed tasks; untimed arrivals land at the bottom
- [ ] Both apply to ARRIVALS only -- once I drag a row, that
      placement is mine forever
- [ ] The priority sort mode is RETIRED (a v0.6.0 reversal, like the
      Kanban reversal): continuous sorts violate manual sovereignty;
      p1/p2/p3 stay as colored tags

## Notes

ADR-013: automation only ever positions arrivals, never existing
rows. System rule 5 made real.