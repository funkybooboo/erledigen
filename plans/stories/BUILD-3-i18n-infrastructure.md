# BUILD-3: i18n infrastructure for the developer

As a developer, I want the i18n substrate (adapter interface, locale
file format, contribution guide), so that adding a language is a
locale file, not a code change.

**Status**: done
**Version**: v0.13.0

## Acceptance criteria
- [x] I18nAdapter in packages/shared; adapter registry like every
      other subsystem
- [x] Locale files are JSON; CI validates completeness
- [x] docs/build/ covers adding a language
- [x] ADR: library choice + file format

## Notes

The extraction work is USE-14; this story is the seam a new language
plugs into.

As-built (2026-10-09/10, PRs #78 + the extraction PRs): the port is
I18nAdapter (locale switching, t with {param} interpolation and
Intl.PluralRules category selection, formatNumber) implemented by
JsonI18nAdapter in shared and registered as container.i18n -- the same
lazy-getter registry as every other adapter. Nested JSON locale files
flatten to dotted keys; plural variants are child nodes
(tasks.one/tasks.other); en.json is canonical and compile-time types
every key. The CI gate (locales.test.ts in the client unit suite)
validates key parity against en, non-empty leaves, well-formed plural
nodes, and that every declared locale has a file. ADR-023 records the
library choice (first-party adapter over paraglide-js/svelte-i18n)
and the file format; docs/build/standards/i18n.md is the working
standard: message format, key conventions, the display/storage split,
the RTL recipe, and the adding-a-language walkthrough (copy en.json,
one import line in locales.ts, green parity test). The bundle budget
moved 712 -> 768 KiB for the adapter + key ids (763.9 KiB measured at
the v0.13.0 close, re-evaluated at the v1.0.0 gate).