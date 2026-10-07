# USE-33: Docs from the app

As an app user, I want a visible link to the user docs in the app (the
far-right bottom-bar "docs ->" link), so that the answers are one
click away.

**Status**: planned
**Version**: v0.18.0

## Acceptance criteria
- [ ] Bottom-bar docs link opens the repo's user docs (docs/use/)
- [ ] Docs strategy: do not document everything; document the
      advanced things (natural-language input, routine schedules,
      filtering, import/export, keyboard shortcuts)

## Notes

The v0.4.0 spec had this link; lost in the frontend simplification.
Repo docs are the source of truth -- served as assets, no hosted-docs
site (ADR-020).