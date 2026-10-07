# USE-19: Project milestones on their days

As an app user, I want a project's start, due, and completed dates to
draw notes on the day list, so that the calendar shows what the
project means without opening anything.

**Status**: planned
**Version**: v0.16.0

## Acceptance criteria
- [ ] Banner-style notes on the project's dates ("X starts", "X
      due", "X completed") -- same family as holiday banners,
      visually distinct
- [ ] Nag on today: an uncompleted project keeps drawing its due-date
      note on today until marked complete

## Notes

Uses the same day-list banner machinery the holidays shipped with
(v0.9.0, history.md).