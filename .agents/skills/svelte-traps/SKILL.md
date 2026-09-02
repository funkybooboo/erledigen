---
name: svelte-traps
description: Svelte 5 and SvelteKit gotchas in the Erledigen client, each of which has caused a real bug in this repo -- runes losing reactivity across await suspension, whitespace stripping, SSR hydration gating, aria string truthiness, e2e assertion mismatches on inputs, dual-theme styling. Use for any change under packages/client or when writing e2e specs.
---

# Svelte 5 Traps

Every item below shipped a real bug in this repo at least once.

## Runes reactivity

- In async event handlers, capture `$derived` values into a local BEFORE the
  first await. During suspension, a later write in the same handler (e.g.
  clearing the input) nulls the derived mid-flight: cost a crash plus lost
  reactivity in InlineAddTask's live habit-hint parsing.
- Rune-using non-component files must end in `.svelte.ts`; a plain `.ts`
  store file silently cannot use `$state`/`$derived`.

## Template rendering

- Svelte 5 strips newline-only whitespace between elements. NEVER rely on
  template whitespace for spacing: HelpModal rendered the "gt" chord with no
  space. Use flex containers with `gap`, always.
- `getAttribute('aria-pressed')` returns the STRING "false", which is
  truthy. Compare with `=== 'true'`.

## SSR + hydration

- The app is server-rendered: markup exists before any handler attaches.
  `+layout.svelte` sets `data-hydrated="true"` on `.app-shell` in onMount;
  the e2e helper `hydrated(page)` (tests/e2e/util.ts) waits for it.
  Interacting before hydration silently does nothing.
- Inputs bound with `bind:value` expose a value, not textContent: an e2e
  `toContainText` assertion on one can NEVER pass (a shipped spec bug
  asserted exactly that). Use `toHaveValue`.

## Styling

- Both themes must work for every component. Follow the tooltip pattern in
  `app.css`: ink/surface token inversion serves both themes from one style
  instead of theme-specific overrides.
- Keybinding hints come from ONE registry: register the shortcut in
  `lib/keybindings.ts` and HelpModal plus every tooltip derive from it.
  Never hand-write a kbd hint.

## Dates

- Task dates are local `yyyy-MM-dd` key strings; do date math through
  `dateProvider` key helpers (today/addDays), never Date-object arithmetic
  -- CalendarModal shipped a timezone bug from deriving dates via
  `new Date()`. (`new Date()` is only fine for wall-clock display, as in
  BottomBar/SettingsModal.) See also the `repo-quirks` skill.