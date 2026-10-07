# USE-13: Accessibility regressions caught by CI

As an app user, I want automated accessibility audits in CI, so that
regressions are caught before they ship even though automation only
sees part of the problem.

**Status**: planned
**Version**: v0.12.0

## Acceptance criteria
- [ ] axe-core (@axe-core/playwright) integrated into the e2e suite;
      every page/modal checked per run
- [ ] Zero violations across surfaces
- [ ] Manual testing (USE-10) still required -- automation covers
      only ~30-40%

## Notes

Catches the machine-detectable share; USE-10 covers the human half.
