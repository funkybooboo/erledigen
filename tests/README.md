# Tests

Erledigen has three layers of automated tests:

## 1. Unit tests (`bun run test:unit` / `mise run test`)

Fast, isolated tests of pure logic and adapters -- no network, no browser.
Run with Bun's built-in test runner. 950+ tests across the three packages:

- `packages/shared` -- date provider, HTTP client, errors, task types, tag utils, recurrence parsing (`parseRecurrence`), frequency formatting, the project auto-distribution planner (`planProjectDistribution`), and the safe-by-construction markdown renderer with its adversarial XSS battery (`renderMarkdown`, ADR-015)
- `packages/server` -- repositories (in-memory **and** SQLite, via shared contract suites), services, middleware, utils, migration runner
- `packages/client` -- DI container, filters, shortcut-registry invariants
  (`keybindings`: every shortcut documented in help, no duplicate keystrokes),
  the live-editor line ops (`liveLines`: split/merge/list continuation), and
  the i18n gates (`locales.test.ts`: every locale file at full key parity
  with en.json; `keyboard` keeps a pending chord armed across a no-op
  registry refresh)

## 2. API integration tests (`bun run test:e2e:api` / `mise run test-e2e`)

Black-box HTTP tests against the live Bun server (port 4000), driven by
Playwright's `APIRequestContext`. They exercise the real HTTP stack -- routing,
validation (Zod), guards (rate limit), middleware (security headers), error
mapping, and content negotiation -- end to end.

Location: `tests/api/` - Config: `playwright.config.ts` (project `api`).

Covers, per resource:

- **tasks** -- create/list/get/update/delete, validation (text length, time
  format), filtering by date/tag/someday/completion, soft-delete + trash +
  restore + purge, parent/child completion roll-up, plain-text content
  negotiation.
- **projects** -- CRUD, auto-generated tag, activate/deactivate, validation.
- **recurring-tasks** -- CRUD, generate-instances (daily/interval), the
  idempotent `generate-all` bulk endpoint, per-habit stats, weekday/weekend
  schedules (`daysOfWeek`), validation (frequency enum, ISO date,
  interval/day bounds), 404 paths.
- **someday-groups** -- CRUD, validation (name/tag/position bounds).
- **holidays** -- CRUD, validation (name/date bounds), `.ics` import (raw text + URL modes, duplicate skipping, non-iCal 400, failing-fetch 400), plain-text content negotiation, export snapshot coverage, and the pre-v0.9.0 snapshot-without-holidays restore path.
- **day notes** (v0.10.0) -- upsert create/replace by date, list/get/delete, validation (empty notes, malformed date), plain-text content negotiation, export snapshot coverage, the pre-v0.10.0 snapshot-without-dayNotes restore path, and duplicate-date rejection.
- **tags** -- list (sorted, de-duped), info (counts), rename, merge (incl.
  no-duplicate target), delete (strip from every task; unknown tag is a
  no-op), validation, content negotiation.
- **user preferences** -- GET defaults, PATCH single-field/nested, validation
  (theme/accent/width enums/bounds), content negotiation.
- **export** -- `GET /api/export` (ADR-008): canonical JSON snapshot (raw
  document, attachment headers, trash included), CSV (header row, RFC 4180
  escaping, `columns` subset + unknown-column 400), Markdown (day sections
  + Someday), iCal (VCALENDAR/VEVENT, floating times), unknown-format 400.
- **import** -- `POST /api/import` (ADR-009): JSON restore (verbatim
  replace incl. preferences, ids kept; invalid snapshot/dangling reference
  400s with nothing written), additive Todoist CSV (labels/priorities/
  subtasks, recurring-date warnings), Things 3 JSON (completed/canceled,
  canceled lands in trash), iCal (timed + all-day), generic CSV (index-based
  `mapping` param + auto-detect round-trip of our own export), unknown
  format 400.
- **meta** -- root, health, 404+CORS, OPTIONS preflight, security headers,
  OpenAPI JSON + YAML.

Each test cleans up the entities it creates via `afterEach` so the shared
in-memory server stays tidy.

## 3. End-to-end browser tests (`bun run test:e2e:ui` / `mise run test-e2e`)

Playwright browser tests against the live SvelteKit client (port 3000) + server
(port 4000). Locally they use the system Chromium at `/usr/bin/chromium`; in
the docker test stack (`compose.test.yaml`) the Chromium bundled in the
Playwright image is used. Tests wait for SvelteKit hydration before
interacting (see `tests/e2e/util.ts` `hydrated()`).

Location: `tests/e2e/` - Config: `playwright.config.ts` (project `e2e`).

Covers:

- **app shell** -- title/landmark, icon-rail (all 10 items), today section,
  bottom bar (clock + task count), modal open/close + keyboard shortcuts,
  `<html lang/dir>` from the persisted locale (v0.13.0 i18n)
  (`/`, `?`, `n`), modal switching, j/k navigation within the Someday panel.
- **keyboard task actions** -- j/k focus movement on the day list, Space
  toggle, 1/2/3/0 priority tags, Enter inline edit, `e` detail modal, `d`
  delete, "g <key>" chords (open, cancel, expiry), typing guards, Ctrl+K.
- **live sync** -- tasks created/completed/deleted in one tab render live
  in a second tab (WebSocket broadcast, no duplicate self-echo).
- **tooltips** -- hover shows the action label plus keybinding chips from
  the shared registry (with and without modifier/shortcut).
- **task CRUD** -- create via inline input, complete via checkbox, inline edit,
  delete + Undo notification + restore, `Ctrl+Z` undo, detail-modal tag editing,
  tag-chip colors (auto-assigned pastel, override, priority pills), and the
  completion flash (arms on the flip, clears after the pulse).
- **habits** -- natural-language habit creation from the inline input
  ("every other day", "every friday at 4:00pm", "every weekday", "every
  weekend"), idempotent `generate-all`, Habits modal create/edit/delete,
  streak stats, `/add <text> every day` from the command palette.
- **modals** -- Theme modal (theme change, `g a` chord, accent scheme
  applied + persisted, size/motion sections driving the root tokens),
  Settings time fields, JSON export download (blob
  filename), Search (filter + hint/empty + `/` command
  mode + `/add`), Trash (list deleted, restore), Calendar (month navigation,
  Today reset, date selection scrolls the day list), the Settings tags
  management screen (counts, rename, recolor, merge and remove with
  confirms), the behavior toggles (empty-day rail collapse with today
  staying, filter fresh-start clearing on load), and the shortcuts
  remapping screen (chord capture, conflict warning, reset, help modal
  showing the live binding).
- **import** (ADR-009) -- additive Todoist CSV through the Settings file
  picker (summary + tasks live in the day list), generic CSV column-mapping
  UI with auto-detected defaults, JSON restore with the always-confirm
  dialog (decline leaves data intact), and the `data:restored` broadcast
  refreshing a page without reload.
- **Someday panel** -- Ctrl+\\ collapse/expand, group create/add-task/rename
  through the panel, ungrouped tasks rendering.
- **holidays** -- Settings add/delete flows and the day-list banner
  (created live through Settings, created in another tab via the WS
  broadcast, removed on delete).
- **summary** -- the v0.9.0 sections: empty-state hiding, overdue rows
  with days-late badges (completed past tasks excluded), the combined
  "Next 14 Days" deadline + holiday list with window bounds, and
  active habit streaks.
- **notes** (v0.10.0) -- live markdown everywhere: rendered task titles
  (raw text opens for editing, accessible name stays the source),
  heading titles, the has-notes indicator, the detail modal's
  live editor (rendered idle, raw line under the caret, Esc settles),
  day notes in the day list (affordance -> write -> debounced persist,
  WS live render, clear-to-delete), the Notes modal lens (grouped by
  owner, edit in place, hop back, empty state), and a browser-side
  XSS smoke (script payload renders inert -- ADR-015).
- **kanban** (v0.9.0) -- column membership (sub-tasks excluded), drag
  Ready -> Scheduled (window-start date), Scheduled -> Ready (date
  cleared), -> Done (completed) with server-side verification,
  Auto-distribute preview + apply, Activate's confirm-and-distribute,
  and the blocked-by lock (blocked class, release on completion,
  picker set/clear).
- **accessibility** (v0.12.0) -- two specs: `accessibility.spec.ts`
  holds the focus-management and live-region behaviors (skip link as
  the first Tab stop, focus trap, Esc focus restore, completion state
  announcements, delete announcement through role=status), and
  `a11y.spec.ts` runs axe-core (WCAG 2.1 A/AA tags) over the page in
  both themes and every modal (plus the Habits form, the project
  detail board, the Someday add-group form, and stacked dialogs),
  asserting zero violations per run; the contrast token pairs are
  unit-tested in `packages/client/src/lib/contrast.test.ts`.
  The manual NVDA/VoiceOver half of the standard is the protocol in
  docs/build/standards/accessibility.md.

## Running everything

```sh
mise run test            # unit tests, in a container
mise run test-e2e        # Playwright api + e2e projects, in the docker test stack
mise run test-all        # unit + Playwright api/e2e, in the docker test stack
mise run ci              # the full CI mirror

# Local, quick feedback:
bun run test:unit        # unit only (fast)
bun run test:e2e:api     # API integration only (spawns an ephemeral in-memory server)
bun run test:e2e:ui      # browser E2E only
bun run test:e2e         # both API + browser (sequential)
bun run test:e2e:no-server  # skip spawning servers; attach to an already-running stack
```

The Playwright config spawns the server with `STORAGE_ADAPTER=memory` (never
reusing a server on port 4000, so no state leaks from the persistent SQLite
file) and `RATE_LIMIT_RPM=10000` (the habits cleanup deletes ~90 generated
instances per test in a burst -- the default 600 rpm limiter would 429 those
requests and fail later tests with phantom "missing" entities). It reuses an
already-running client locally. In CI it starts fresh instances. The docker
test stack (`compose.test.yaml`) is fully self-contained -- no bind mounts, no
published ports, nothing written to the host; it sets the same test env
(`STORAGE_ADAPTER=memory`, `RATE_LIMIT_RPM=10000`).

## Notes

- API/E2E tests target the **server directly** (`http://localhost:4000`) for
  seeding/cleanup, even in the browser project, so they are independent of
  the client's CORS/proxy behavior.
- Browse the API surface against a running server via Swagger UI at
  `/api/docs` (ADR-024); the Playwright `tests/api/` suite is the
  single asserted API suite.
- The Playwright suites and `playwright.config.ts` are biome-linted and
  type-checked like everything else: `tests/tsconfig.json` carries the same
  strict flags as the packages and joins the `mise run type-check` chain
  (`bun run type-check:tests`).
- **Flake triage**: locally, vite occasionally binds `::1` only, producing
  intermittent ERR_CONNECTION_REFUSED failures that rotate between tests.
  Any connection-looking failure must be re-run STANDALONE; only a standalone
  repro is a real failure.
- **Isolated verification stack** -- when the dev stack owns 3000/4000, spin
  your own on alternate ports instead of killing anyone's servers:

  ```sh
  # Run the server entry DIRECTLY: package-script wrappers spawn a child
  # that survives `kill $!`.
  cd packages/server && PORT=4100 STORAGE_ADAPTER=memory bun src/index.ts
  cd packages/client && VITE_PORT=3100 VITE_API_URL=http://localhost:4100 bun run dev

  PLAYWRIGHT_NO_SERVER=1 \
  PLAYWRIGHT_API_BASE_URL=http://localhost:4100 \
  PLAYWRIGHT_E2E_BASE_URL=http://localhost:3100 \
  bunx playwright test [spec]
  ```

  Check `lsof -ti:4100,3100` before and after; kill both when done. The
  client's default API origin is `http://localhost:4000` (`VITE_API_URL`) --
  without it a manual client talks to whatever server sits on 4000.
- The local client webServer REUSES an already-running vite on 3000, so an
  e2e run can attach to your dev browser (phantom page loads, HMR noise).
  Prefer the isolated stack or the docker test stack when a dev client is
  running.
