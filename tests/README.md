# Tests

Erledigen has three layers of automated tests:

## 1. Unit tests (`bun run test:unit` / `mise run test`)

Fast, isolated tests of pure logic and adapters — no network, no browser.
Run with Bun's built-in test runner. ~440 tests across the three packages:

- `packages/shared` — date provider, HTTP client, errors, task types, tag utils, recurrence parsing (`parseRecurrence`), frequency formatting
- `packages/server` — repositories (in-memory **and** SQLite, via shared contract suites), services, middleware, utils, migration runner
- `packages/client` — DI container, filters, shortcut-registry invariants
  (`keybindings`: every shortcut documented in help, no duplicate keystrokes)

## 2. API integration tests (`bun run test:e2e:api` / `mise run test-e2e`)

Black-box HTTP tests against the live Bun server (port 4000), driven by
Playwright's `APIRequestContext`. They exercise the real HTTP stack — routing,
validation (Zod), guards (rate limit), middleware (security headers), error
mapping, and content negotiation — end to end.

Location: `tests/api-tests/` · Config: `playwright.config.ts` (project `api`).

Covers, per resource:

- **tasks** — create/list/get/update/delete, validation (text length, time
  format), filtering by date/tag/someday/completion, soft-delete + trash +
  restore + purge, parent/child completion roll-up, plain-text content
  negotiation.
- **projects** — CRUD, auto-generated tag, activate/deactivate, validation.
- **recurring-tasks** — CRUD, generate-instances (daily/interval), the
  idempotent `generate-all` bulk endpoint, per-habit stats, weekday/weekend
  schedules (`daysOfWeek`), validation (frequency enum, ISO date,
  interval/day bounds), 404 paths.
- **someday-groups** — CRUD, validation (name/tag/position bounds).
- **tags** — list (sorted, de-duped), info (counts), rename, merge (incl.
  no-duplicate target), validation, content negotiation.
- **user preferences** — GET defaults, PATCH single-field/nested, validation
  (theme/width enums/bounds), content negotiation.
- **meta** — root, health, 404+CORS, OPTIONS preflight, security headers,
  OpenAPI JSON + YAML.

Each test cleans up the entities it creates via `afterEach` so the shared
in-memory server stays tidy.

## 3. End-to-end browser tests (`bun run test:e2e:ui` / `mise run test-e2e`)

Playwright browser tests against the live SvelteKit client (port 3000) + server
(port 4000). Locally they use the system Chromium at `/usr/bin/chromium`; in
the docker test stack (`compose.test.yaml`) the Chromium bundled in the
Playwright image is used. Tests wait for SvelteKit hydration before
interacting (see `tests/e2e/util.ts` `hydrated()`).

Location: `tests/e2e/` · Config: `playwright.config.ts` (project `e2e`).

Covers:

- **app shell** — title/landmark, icon-rail (all 9 items), today section,
  bottom bar (clock + task count), modal open/close + keyboard shortcuts
  (`/`, `?`, `n`), modal switching, j/k navigation within the Someday panel.
- **keyboard task actions** — j/k focus movement on the day list, Space
  toggle, 1/2/3/0 priority tags, Enter inline edit, `e` detail modal, `d`
  delete, "g <key>" chords (open, cancel, expiry), typing guards, Ctrl+K.
- **live sync** — tasks created/completed/deleted in one tab render live
  in a second tab (WebSocket broadcast, no duplicate self-echo).
- **tooltips** — hover shows the action label plus keybinding chips from
  the shared registry (with and without modifier/shortcut).
- **task CRUD** — create via inline input, complete via checkbox, inline edit,
  delete + Undo notification + restore, `Ctrl+Z` undo, detail-modal tag editing.
- **habits** — natural-language habit creation from the inline input
  ("every other day", "every friday at 4:00pm", "every weekday", "every
  weekend"), idempotent `generate-all`, Habits modal create/edit/delete,
  streak stats, `/add <text> every day` from the command palette.
- **modals** — Settings theme change (document `data-theme` + server
  persistence), timezone reset, Search (filter + hint/empty + `/` command
  mode + `/add`), Trash (list deleted, restore), Calendar (month navigation,
  Today reset, date selection scrolls the day list).
- **Someday panel** — Ctrl+\\ collapse/expand, group create/add-task/rename
  through the panel, ungrouped tasks rendering.

## Running everything

```sh
mise run test            # unit tests, in a container
mise run test-e2e        # Playwright api + e2e projects, in the docker test stack
mise run test-api        # Bruno API collection, against the dockerized test server
mise run test-all        # Bruno + Playwright in the docker test stack
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
file) and reuses an already-running client locally. In CI it starts fresh
instances. The docker test stack (`compose.test.yaml`) is fully
self-contained — no bind mounts, no published ports, nothing written to the
host.

## Notes

- API/E2E tests target the **server directly** (`http://localhost:4000`) for
  seeding/cleanup, even in the browser project, so they are independent of
  the client's CORS/proxy behavior.
- The `tests/api/` Bruno collection (`.bru` files) is a separate API
  exerciser (manual in the Bruno GUI, or automated via `mise run test-api` /
  `bun run test:api`); the Playwright `tests/api-tests/` suite is the
  automated, asserted version of the same surface.
- **Flake triage**: locally, vite occasionally binds `::1` only, producing
  intermittent ERR_CONNECTION_REFUSED failures that rotate between tests.
  Any connection-looking failure must be re-run STANDALONE; only a standalone
  repro is a real failure.
- **Isolated verification stack** — when the dev stack owns 3000/4000, spin
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
  client's default API origin is `http://localhost:4000` (`VITE_API_URL`) —
  without it a manual client talks to whatever server sits on 4000.
- The local client webServer REUSES an already-running vite on 3000, so an
  e2e run can attach to your dev browser (phantom page loads, HMR noise).
  Prefer the isolated stack or the docker test stack when a dev client is
  running.
