# BUILD-2: Work story-first

As a developer, I want every change tied to a named user story, so
that nothing is built that does not serve one of the three roles --
and so the trail from "why" to "which role" to "what" is always
traceable.

**Status**: done
**Version**: v0.10.1

## Acceptance criteria
- [x] The decision is recorded as ADR-017
- [x] plans/ restructured: identity.md, roadmap.md (queue),
      history.md, stories/ (one file per story)
- [x] Commitlint enforces the `Story: <ID>` footer (chore(release)
      exempt)
- [x] The PR template carries a story field
- [x] Role issue templates (USE/HOST/BUILD) filed under .github/

## Notes

ADR-017. The forward roadmap (v0.11.0 onward) is converted to story
files; issues.md stays verbatim as story input.
