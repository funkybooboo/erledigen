# ADR-023: First-Party i18n Adapter with JSON Locale Files

Date: 2026-10-09

Status: Accepted

## Context

v0.13.0 is the internationalization build: the interface in the
user's language (USE-14), locale-aware formatting (USE-15), and the
substrate that makes adding a language a file drop, not a code change
(BUILD-3). The stories name a library shortlist -- paraglide-js
(compile-time) and svelte-i18n (runtime) -- and require the choice to
be recorded here alongside the file format.

The forces:

- **Only `en` ships.** Other languages arrive as contributions; the
  completeness of a contributed file is a CI concern, not a feature.
- **Svelte 5 runes everywhere.** The client's stores are class-based
  `$state` fields; re-rendering is method calls reading `$state`.
- **The codebase hand-rolls its ports.** DateProvider, Logger, the
  markdown renderer (ADR-015), the keybinding matcher -- each is a
  first-party interface in `packages/shared` with a universal
  implementation, wired through the container. The i18n story itself
  asks for an `I18nAdapter` "in packages/shared; adapter registry like
  every other subsystem".
- **The browser bundle is size-gated** (712 KiB at v0.12.0).
- **Formatting must ride the platform Intl API** regardless of the
  message library: dates, times, numbers, plural categories.

## Decision

**A first-party `I18nAdapter` port in `packages/shared`, implemented by
`JsonI18nAdapter`, with nested JSON locale files -- no i18n library.**

- **Port + adapter.** `I18nAdapter` (locale switching, `t(key, params)`,
  `formatNumber`) and `JsonI18nAdapter` live next to DateProvider and
  Logger in `packages/shared/src/adapters/i18n/`; the client container
  exposes it as `container.i18n`, and the runes store
  (`i18nStore.svelte.ts`) mirrors the locale in `$state` so template
  call-sites re-render on change.
- **File format.** One nested JSON map per locale,
  `packages/client/src/lib/i18n/locales/<locale>.json`; the dotted path
  to a leaf is the message key. `{name}` placeholders interpolate;
  a numeric `count` param selects between plural variants
  (`key.one`, `key.other`, ...) via `Intl.PluralRules` and formats via
  `Intl.NumberFormat`. `en.json` is canonical: it types every `t()`
  call at compile time (the `TranslationKey` in `locales.ts` derives
  from it) and is the completeness baseline for the parity gate.
- **Loading.** A static import map (`locales.ts`), not a dynamic
  glob: the Bun test runner cannot resolve `import.meta.glob`, and the
  CI completeness test imports the same module the app does. Adding a
  language = commit the JSON file + one import line.
- **Locale display.** Date/time display stays with the
  `DateProvider` (it gains a locale alongside its timezone); counts and
  number display go through the adapter's `formatNumber`.
- **Script direction** resolves from the locale's script via
  `Intl.Locale.maximize()` (`textDirection` in shared): layout is
  written with logical CSS properties, and `dir` lands on `<html>`
  when the locale applies.

## Rationale

paraglide-js is the strongest library answer -- compile-time
extraction, per-message functions, tree-shaken runtime -- but it adds
a compiler toolchain (a vite plugin, generated output, its own lint)
to ship exactly one locale, and its generated functions fight the
container-registry shape the stories mandate. svelte-i18n is a
pre-runes runtime store model; it would be the only dependency in the
app whose reactivity model duplicates Svelte 5's own. The actual
problem is small: flat lookup + `{param}` interpolation + plural
category selection + `Intl` formatting is ~100 lines in the shared
package, fully testable, zero bytes of dependency. The risk a library
would have carried here is not implementation but lock-in: this app's
message needs are stable (single-user, ~700 strings), and when a real
second locale arrives, the parity gate and file format are what
matter, not the lookup engine.

Compile-time key typing -- paraglide's genuine advantage -- is
preserved by deriving `TranslationKey` from `en.json` itself, so a
typo'd key still fails the build.

## Consequences

- **A new language is a file, a line, and a green CI run.** The parity
  test (key-set equality with `en.json`) and the shape walk
  (non-empty string leaves, plural categories only inside plural
  nodes) run in the unit suite; Settings lists locales from the same
  import map.
- **Missing keys never brick the UI**: lookup falls back
  active-locale -> `en` -> raw key, and `setLocale` ignores ids
  without a file.
- **The bundle grows by the message templates and their key names.**
  Measured and consciously raised with the build: 664 -> 676 -> 712
  -> 768 KiB (v0.13.0, +56 KiB for the adapter + locale file + key
  ids); the raise rides this ADR's justification, re-evaluated at the
  v1.0.0 gate.
- **Natural-language INPUT stays English** (the `createFromText` date
  phrases and recurrence grammar). USE-14/15 localize display; the
  input grammar localizing is future, deliberate work if lived
  experience asks.
- **Translating a message means touching its component's template
  call-site key structure rarely** -- keys are stable ids, not English
  text, so a wording change never churns code.