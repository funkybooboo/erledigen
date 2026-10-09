# USE-13: Accessibility regressions caught by CI

As an app user, I want automated accessibility audits in CI, so that
regressions are caught before they ship even though automation only
sees part of the problem.

**Status**: done
**Version**: v0.12.0

## Acceptance criteria
- [x] axe-core (@axe-core/playwright) integrated into the e2e suite;
      every page/modal checked per run
- [x] Zero violations across surfaces
- [x] Manual testing (USE-10) still required -- automation covers
      only ~30-40%

## Notes

Catches the machine-detectable share; USE-10 covers the human half.

As-built (2026-10-09, PR #73): @axe-core/playwright is a dev
dependency (never in the browser bundle) and tests/e2e/a11y.spec.ts
runs WCAG 2.1 A/AA tags over the page in both themes, all 11 rail
modals, the task detail modal, the Habits create form, the project
detail board, the Someday add-group form, and stacked Settings +
Confirm dialogs -- zero violations per run. Two timing traps are
documented in the spec header: mid-transition sampling fabricates
contrast failures (audits wait for all running animations via
document.getAnimations()), and the rail buttons toggle their modals.
The audit is green against the whole v0.12.0 stack (USE-9/10/11/12
fixes) and now guards it. The manual share is the USE-10 protocol --
the standard says it stays required.