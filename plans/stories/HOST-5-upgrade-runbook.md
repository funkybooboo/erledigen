# HOST-5: Upgrade erledigen without losing data

As an operator, I want a documented, boring upgrade path, so that
moving to a new release is a pull-and-restart with no surprises.

**Status**: planned
**Version**: v0.10.1

## Acceptance criteria
- [ ] docs/host/ upgrade runbook: pull the new image tag, restart,
      migrations apply at boot (fail-fast), verify with /api/health
- [ ] Image tag policy documented (release tags + floating tag)
- [ ] The runbook covers compose and Helm

## Notes

ADR-018. Migrations-at-boot is already the mechanism; this documents
it and makes the tag policy explicit.
