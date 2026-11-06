# USE-19: Project milestones on their days

As an app user, I want a project's start, due, and completed dates to
draw notes on the day list, so that the calendar shows what the
project means without opening anything.

**Status**: done (v0.16.0)
**Version**: v0.16.0

## Acceptance criteria
- [x] Banner-style notes on the project's dates ("X starts", "X
      due", "X completed") -- same family as holiday banners,
      visually distinct
- [x] Nag on today: an uncompleted project keeps drawing its due-date
      note on today until marked complete

## Notes

Uses the same day-list banner machinery the holidays shipped with
(v0.9.0, history.md).

As built (v0.16.0):

- `projectMilestones.ts` holds the pure derivation (`milestonesOn` +
  `dueNagOn`, unit-tested): the start/due/completed dates each draw a
  quiet pill chip on their day (`completedAt`'s date part decides
  its day), and an uncompleted project whose due date has passed
  keeps drawing its due note on today -- only today, and never
  alongside the due date itself, which already carries the real
  banner.
- Same pill family as the holiday banners, visually distinct: due
  (and the nag) carries the danger tint; starts/completed stay
  neutral. The banners are notes, not links -- the story wants the
  calendar to say what the project means without opening anything.
