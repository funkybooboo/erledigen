---
name: bun-traps
description: Bun runtime pitfalls that have bitten this repo -- package-script wrappers leak child processes, bun build does not bundle .sql so uncommitted migrations break CI builds, in-memory vs sqlite adapters diverge (UNIQUE tag), a lazy-prefix regex alternation pathology that rejects valid input. Use when running servers, building, adding migrations or repositories, or writing parser regexes.
---

# Bun Traps

## Process management

- `bun run dev` / `bun run start` / any package-script wrapper spawns a
  WRAPPER process: `kill $!` kills the wrapper and leaves the real server
  child alive, still holding the port. For manually-run servers invoke the
  entry directly (`bun packages/server/src/index.ts`) and verify with
  `lsof -ti:<port>` after killing.
- `bun --watch` servers leaked by interrupted playwright runs hold port
  4000; `bun run kill-server-port` reclaims it.

## Build

- `bun build` does NOT bundle non-JS assets. The server build script
  explicitly copies `src/adapters/data/migrations/` into `dist/`. A new
  `.sql` migration that is left uncommitted therefore breaks every docker
  and CI build while local dev (running from source) keeps passing. Never
  leave a migration untracked; commit it with the code that needs it.
- The client build is size-gated: CI fails when `packages/client/dist`
  exceeds 512KB (see the `ci` task in mise.toml and ci.yml). Watch this when
  adding dependencies or large static assets.

## bun:sqlite and the storage adapters

- `STORAGE_ADAPTER=memory|sqlite` swaps repo implementations in the DI
  container; container tests force `process.env['STORAGE_ADAPTER']` with
  bracket access (noPropertyAccessFromIndexSignature rejects dot access).
- The two adapters are NOT behaviorally identical: `projects.tag` is UNIQUE
  in sqlite but not in-memory, so POST /api/projects with an existing tag
  passes on memory and 500s on sqlite. Any repo-behavior change must be
  added to the contract suites in `packages/server/src/adapters/data/contracts/`,
  which run against BOTH adapters.
- Raw SQL, no ORM. Migrations are forward-only, tracked in the `_migrations`
  table, run fail-fast at boot. IDs are TEXT stringified integers; sqlite
  matches in-memory semantics via `MAX(CAST(id AS INTEGER))+1`.

## Regex

- One big alternation with a lazy prefix plus nested optional groups hits a
  Bun/JS backtracking pathology that REJECTS VALID INPUT (parseRecurrence
  was rewritten because of it). Build parsers as an ordered array of small
  anchored regexes instead. If a parser mysteriously fails on input that
  looks fine, suspect this before anything else.