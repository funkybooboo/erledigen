# USE-21: A schedule grammar that says what I mean

As an app user, I want to write richer schedules in plain text -- tags
composed with the phrase in any order, until/starting dates, multiple
times a day, monthly rules, biweekly, quarterly, time ranges -- so
that what I type is what happens.

**Status**: planned
**Version**: v0.17.0

## Acceptance criteria
- [ ] #tags and the recurrence phrase parse together in any order
      ("water plants #home every mon and wed" == "water plants every
      mon and wed #home")
- [ ] "until <date>" (ends the routine), "starting <date>"
- [ ] "twice a day", multiple times ("at 9am and 5pm" -- times[]
      grows from a single startTime; one instance per time)
- [ ] "the first/last <weekday> of the month", "biweekly",
      "quarterly", time ranges ("4 to 5pm")
- [ ] Parser stays trailing-only, ordered anchored regexes, fully
      unit-tested (the Bun backtracking rule in code-standards)

## Notes

Absorbs the UX-audit habit findings: tags+phrase composition was the
headline gap.