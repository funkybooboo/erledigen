# USE-2: Theming is its own modal

As an app user, I want appearance settings in a dedicated Theme modal
on the icon rail, so that changing how the app looks is not buried in
behavior settings.

**Status**: planned
**Version**: v0.11.0

## Acceptance criteria
- [ ] A Theme modal joins the icon rail (light/dark/system switching
      lives there)
- [ ] ALL appearance settings move out of Settings; Settings keeps
      only behavior
- [ ] Persisted in UserPreferences as today

## Notes

UX-audit finding (2026-10-03): "theming is not Settings". Moved to
v0.11.0 by the 2026-10-04 restructure.
