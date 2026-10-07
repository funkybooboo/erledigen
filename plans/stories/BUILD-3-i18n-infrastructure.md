# BUILD-3: i18n infrastructure for the developer

As a developer, I want the i18n substrate (adapter interface, locale
file format, contribution guide), so that adding a language is a
locale file, not a code change.

**Status**: planned
**Version**: v0.13.0

## Acceptance criteria
- [ ] I18nAdapter in packages/shared; adapter registry like every
      other subsystem
- [ ] Locale files are JSON; CI validates completeness
- [ ] docs/build/ covers adding a language
- [ ] ADR: library choice + file format

## Notes

The extraction work is USE-14; this story is the seam a new language
plugs into.