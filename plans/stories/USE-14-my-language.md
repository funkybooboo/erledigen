# USE-14: The app in my language

As an app user, I want the interface in my language, so that the app
speaks to me natively.

**Status**: done
**Version**: v0.13.0

## Acceptance criteria
- [x] I18nAdapter interface in packages/shared; pluggable providers
- [x] All user-facing strings extracted to locale files (en.json
      canonical); zero hardcoded UI strings
- [x] Language selection in Settings, stored in UserPreferences
- [x] Locale files validated in CI (no missing keys)
- [x] Only `en` ships; other languages arrive as contributions

## Notes

Library shortlist: paraglide-js (compile-time) or svelte-i18n -- the
choice is an ADR at build time. The hardcoded en-US month-name
formatters (CalendarModal, HabitHeatmap, SettingsModal) move through
the locale layer.

As-built (2026-10-10, PRs #78, #79, #81, #83): ADR-023 chose neither
library -- a first-party I18nAdapter port + JsonI18nAdapter in
packages/shared, matching every other hand-rolled subsystem
(DateProvider, Logger, the markdown renderer). en.json is canonical and
TYPES every t() call (TranslationKey derives from the JSON at compile
time); the completeness gate (locales.test.ts) enforces key parity,
and the adapter falls back active locale -> en -> raw key so nothing
can brick. Loading is a static import map (Bun's runner cannot resolve
import.meta.glob), so a contributed language is a JSON file + one
import line. The Settings Language selector lists the shipped locales
(en only) with Intl.DisplayNames names, persists through
UserPreferences.locale, and applies via i18nStore.apply (<html lang +
dir included). Keybinding labels became registry KEYS
(Shortcut.labelKey) translated at every render site -- tooltips, help
table, Settings rows; the keybinding grammar's keycaps (Space, Esc,
Ctrl) and the palette's typed command ids ('/add') stay literal
syntax, recorded in the ADR and the i18n standard. The recurrence
sentences became a RecurrencePhrases descriptor so the schedule logic
stays in shared while the wording localizes. One deliberate rendering
change: the CSV column-mapping aria labels carry localized field names
(the e2e assertion follows). Everything else renders byte-identical
English, proven by the full e2e suite passing unchanged through every
extraction PR.