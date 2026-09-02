---
name: run-e2e
description: Run and triage Erledigen's Playwright api/e2e projects and the Bruno collection -- local runs vs the dockerized test stack, isolated verification stacks on alternate ports, spec conventions, and the known environmental flakes. Use when running browser/HTTP tests or spinning up a manual test stack.
---

# Run E2E and API Tests

## What runs where

`playwright.config.ts` defines two projects, run serially with 1 worker:

- `api`: `tests/api-tests/`, black-box HTTP against the server (default
  `http://localhost:4000`)
- `e2e`: `tests/e2e/`, browser tests against the client (default
  `http://localhost:3000`)

Unless `PLAYWRIGHT_NO_SERVER=1`, Playwright spawns both dev servers itself:
the server with `STORAGE_ADAPTER=memory` (ephemeral; it refuses to reuse a
server already on the port), the client with `reuseExistingServer: !CI`
(it WILL attach to a vite dev server already on 3000).

## Local runs (fast feedback)

    bun run test:e2e:api     # pretest kills anything on :4000 first
    bun run test:e2e:ui      # ditto
    bun run test:e2e         # both projects
    bun run test:api         # Bruno collection (cd tests/api; @usebruno/cli)

Dockerized, for CI parity: `mise run test-e2e` / `mise run test-api` /
`mise run test-all` (`compose.test.yaml`; servers are separate compose
services; Playwright runs with `PLAYWRIGHT_NO_SERVER=1` and env-driven URLs).

## Isolated manual stack (verify without touching the dev stack)

When the docker dev stack owns 3000/4000, spin your own on alternate ports:

    # server: memory storage, own port -- run `bun src/index.ts` DIRECTLY;
    # `bun run dev`/`start` wrappers spawn a child that survives `kill $!`
    cd packages/server
    PORT=4100 STORAGE_ADAPTER=memory bun src/index.ts

    # client
    cd packages/client
    VITE_PORT=3100 VITE_API_URL=http://localhost:4100 bun run dev

Then point Playwright at it:

    PLAYWRIGHT_NO_SERVER=1 \
    PLAYWRIGHT_API_BASE_URL=http://localhost:4100 \
    PLAYWRIGHT_E2E_BASE_URL=http://localhost:3100 \
    bunx playwright test [spec]

Traps: check `lsof -ti:4100,3100` before and after; kill BOTH processes when
done. The client's default API origin is `http://localhost:4000`
(`VITE_API_URL`), so a client started without it talks to the wrong server.

## Known flakes (do not chase ghosts)

- Intermittent ERR_CONNECTION_REFUSED: vite sometimes binds `::1` only.
  Environmental. RULE: any connection-looking failure is re-run standalone;
  only a standalone repro counts as a real failure.
- Playwright runs killed by a timeout leak `bun --watch` servers on 4000;
  `bun run kill-server-port` reclaims it. Check for orphans after interrupted
  runs.

## Spec conventions

- Helpers in `tests/e2e/util.ts`: `await hydrated(page)` before any
  interaction (SSR renders markup before handlers attach);
  `modal(page, title)` finds dialogs by accessible role; seed/cleanup go
  through `SERVER_URL`, bypassing the client.
- Every test cleans up the entities it creates (single serial shared server,
  in-memory storage).
- API specs cover happy path + validation + 404 + content negotiation per
  resource; mirror new endpoints there (see the `add-api-endpoint` skill).