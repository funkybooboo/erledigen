# USE-14: The app in my language

As an app user, I want the interface in my language, so that the app
speaks to me natively.

**Status**: planned
**Version**: v0.13.0

## Acceptance criteria
- [ ] I18nAdapter interface in packages/shared; pluggable providers
- [ ] All user-facing strings extracted to locale files (en.json
      canonical); zero hardcoded UI strings
- [ ] Language selection in Settings, stored in UserPreferences
- [ ] Locale files validated in CI (no missing keys)
- [ ] Only `en` ships; other languages arrive as contributions

## Notes

Library shortlist: paraglide-js (compile-time) or svelte-i18n -- the
choice is an ADR at build time. The hardcoded en-US month-name
formatters (CalendarModal, HabitHeatmap, SettingsModal) move through
the locale layer.
