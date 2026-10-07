# USE-1: Find the documentation written for my role

As an app user, operator, or developer, I want a documentation home
written for my role, so that everything I need is in one place and
nothing I read assumes a different job than mine.

**Status**: doing
**Version**: v0.10.1

## Acceptance criteria
- [ ] `docs/use/` (app users), `docs/host/` (operators), `docs/build/`
      (developers) exist with a README routing each role in
- [ ] Today's `docs/use/` and `docs/build/` content moves there with
      every cross-reference updated (lychee enforces)
- [ ] CONTRIBUTING.md stays at the repo root and routes readers to
      their role home
- [ ] The repo README points each role at its home

## Notes

ADR-020. The role homes match the story prefixes (ADR-017).
