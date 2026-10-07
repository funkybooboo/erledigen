# USE-25: Routine rows read as routine rows

As an app user, I want the day list to make routine instances obvious
and clickable -- the row icon opens the routine's detail, and rows
carry no decorative left-edge color -- so that recurring work is
identifiable without visual noise.

**Status**: planned
**Version**: v0.17.0

## Acceptance criteria
- [ ] Clicking the recurrence icon on a row opens the Routines modal
      at that routine's detail (UX-audit finding: no more hunting
      through the modal)
- [ ] No left-edge coloring on routine instances (UX-audit finding:
      the icon is the only marker)
- [ ] From the detail, jump back to the routine's instances on days

## Notes

ADR-013; the priority-sort left borders die with the sort mode
(USE-26).