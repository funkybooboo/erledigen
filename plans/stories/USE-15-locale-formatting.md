# USE-15: Dates and numbers in my locale

As an app user, I want dates, times, and counts formatted for my
locale, so that the calendar reads like home.

**Status**: planned
**Version**: v0.13.0

## Acceptance criteria
- [ ] Day headers, task dates, times use the Intl API against the
      selected locale
- [ ] Counts via Intl.NumberFormat; plurals correct ("1 task" vs
      "2 tasks")
- [ ] Layout RTL-ready (logical CSS properties; adding an RTL
      language = locale file + dir="rtl")

## Notes

dateKeys stays the local yyyy-MM-dd storage format; only display
localizes.