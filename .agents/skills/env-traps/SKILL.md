---
name: env-traps
description: Port ownership and stack topology for Erledigen -- docker dev stack owns 3000/4000, scripts that kill those ports without asking, playwright server spawning and reuse behavior, the isolated verification stack recipe, e2e flake triage rules, and this-machine quirks (permissions extension denies /dev/null redirects, UTC clock confusion). Use before starting/stopping servers, running e2e, or debugging failures that pass standalone.
---

# Environment Traps

## Port ownership: 3000/4000 are live infrastructure

- The docker dev stack (`mise run dev`) publishes 3000 (client) + 4000
  (server); the user normally has it or `bun --watch` servers running.
- These scripts KILL whatever holds those ports, without asking:
  `predev` (3000+4000), `pretest:e2e*` (4000), and `mise run ci`. Never run
  them while someone else's dev stack is up.
- The prod stack (`compose.prod.yaml`) never collides: single origin behind
  Caddy on PROD_PORT (default 8080); the client image is built same-origin
  (empty VITE_API_URL) and the proxy routes /api and /ws; sqlite data
  persists in the prod-data named volume.
- Before starting or killing anything: `lsof -ti:3000,4000` and check who
  owns the processes. Kill leftovers of YOUR runs only.

## Playwright environment

- Locally Playwright drives the system chromium at /usr/bin/chromium
  (PLAYWRIGHT_CHROMIUM); the docker test image uses the bundled one
  (PLAYWRIGHT_USE_BUNDLED_CHROMIUM=1).
- Unless PLAYWRIGHT_NO_SERVER=1, Playwright spawns its own servers: the
  server ALWAYS with STORAGE_ADAPTER=memory and never reusing an occupied
  port; the client with reuseExistingServer (!CI), meaning it WILL attach
  to a vite already on 3000 -- including the user's dev browser (phantom
  page loads, HMR noise).
- Both projects share ONE serial in-memory server (workers=1); every test
  must clean up the entities it creates.

## Isolated verification stack (when dev owns 3000/4000)

    cd packages/server && PORT=4100 STORAGE_ADAPTER=memory bun src/index.ts
    cd packages/client && VITE_PORT=3100 VITE_API_URL=http://localhost:4100 bun run dev

    PLAYWRIGHT_NO_SERVER=1 \
    PLAYWRIGHT_API_BASE_URL=http://localhost:4100 \
    PLAYWRIGHT_E2E_BASE_URL=http://localhost:3100 \
    bunx playwright test [spec]

Run the server entry DIRECTLY (`bun src/index.ts`), not via a package
script -- wrappers leak child processes. Check `lsof -ti:4100,3100` before
and after; kill both when done. The client's default API origin is
http://localhost:4000 (VITE_API_URL): a manual client started without it
talks to whatever server sits on 4000.

## Flake triage: do not chase ghosts

- Intermittent ERR_CONNECTION_REFUSED: vite sometimes binds `::1` only.
  Environmental; this suite historically shows about one rotating flake per
  run from it. RULE: any connection-looking failure is re-run STANDALONE;
  only a standalone repro counts as a real failure.

## This machine

- The pi permissions extension DENIES bash redirects to /dev/null. Use the
  edit tool for file changes; redirect to real files when capturing output.
- `bash date` prints UTC while `ps` shows local time (UTC-6 here): do not
  misjudge process recency from timestamps.
- Another agent session may be working concurrently: any git operation
  follows the `git-concurrent-sessions` skill. If files seem to vanish
  mid-session, re-check disk state first -- a concurrent git operation
  raced you; it is almost never data loss.