# USE-34: No store-wide counter

As an app user, I want the bottom-right "{total} tasks {done} done"
readout gone, so that the bar carries meaning, not numbers about
everything at once.

**Status**: planned
**Version**: v0.18.0

## Acceptance criteria
- [ ] The store-wide counter is removed
- [ ] The date/clock stays

## Notes

UX-audit finding: "245 tasks 0 done" counts the whole loaded store and
carries no meaning.