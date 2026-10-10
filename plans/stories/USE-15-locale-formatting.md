# USE-15: Dates and numbers in my locale

As an app user, I want dates, times, and counts formatted for my
locale, so that the calendar reads like home.

**Status**: done
**Version**: v0.13.0

## Acceptance criteria
- [x] Day headers, task dates, times use the Intl API against the
      selected locale
- [x] Counts via Intl.NumberFormat; plurals correct ("1 task" vs
      "2 tasks")
- [x] Layout RTL-ready (logical CSS properties; adding an RTL
      language = locale file + dir="rtl")

## Notes

dateKeys stays the local yyyy-MM-dd storage format; only display
localizes.

As-built (2026-10-10, PRs #79, #81, #83, #84): the DateProvider owns
date display and gained a display locale (setLocale, 'en' default)
next to its timezone -- formatDate/formatTime/formatDateTime/
formatDateParts localize, while the storage split is enforced by
construction: keyFromInstant parses with fixed en-US numeric parts, so
non-Gregorian calendars (ar-SA defaults to Islamic) and non-ASCII
digits (ar-EG) can never reach a stored key; unit tests pin the
invariant. Counts and plurals ride the JsonI18nAdapter (numeric params
format through Intl.NumberFormat; plural-variant keys select by
Intl.PluralRules -- every `${n} task${s}` concatenation is gone). The
month/weekday names the stories called out (Calendar, heatmap,
minimap, habit forms, the Settings timezone preview) format via Intl
against the active locale. The RTL sweep converted every physical
directional property in the client to logical equivalents
(margin-inline-*, border-inline-*, text-align start/end,
inset-inline-*): <html dir> sets itself from the locale's script
(textDirection in shared), so an RTL language is a locale file and
nothing else; the e2e suite asserts lang/dir and passes unchanged
(logical properties resolve to identical pixels in LTR).