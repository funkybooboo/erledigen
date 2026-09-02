# AGENTS.md

Working notes for AI coding agents operating in this repo. Human-oriented docs
start at [README.md](README.md) and [docs/devs/README.md](docs/devs/README.md).
Step-by-step workflows live as skills in `.agents/skills/` (index at the
bottom); load the matching skill before starting that kind of work.

## What this is

Erledigen is a self-hosted task app: a continuously-scrolling daily list, a
Someday capture panel, and habits (recurring templates) that generate instances
into the list. Monorepo, end-to-end TypeScript, Bun runtime, Svelte 5 client,
adapter-pattern server, WebSocket sync across tabs. Privacy-first: no
analytics, no telemetry.

## Layout

| Path | What it is |
|------|------------|
| `packages/shared/` | Types, utils, errors, constants, and adapter interfaces (date, http, logging, config) used by BOTH server and client |
| `packages/server/` | Bun HTTP + WS server: `routes/` thin handlers, `services/` business rules, `adapters/data/` repos (in-memory + SQLite), DI in `container.ts`, Zod schemas in `openapi/` |
| `packages/client/` | SvelteKit + Svelte 5 runes app: `lib/stores/` (runes class stores), `lib/services/` (fetch wrappers), `lib/components/` (+ `modals/`), single page + layout |
| `tests/api-tests/` | Playwright `api` project: black-box HTTP tests |
| `tests/e2e/` | Playwright `e2e` project: browser tests (helpers in `util.ts`) |
| `tests/api/` | Bruno `.bru` request collection |
| `docs/devs/` | Standards, architecture, ADRs; read the relevant one before designing |
| [plans/roadmap.md](plans/roadmap.md) | Feature roadmap and version gates |
| `mise.toml` | Task runner; source of truth for how everything runs |

## Toolchain

- Bun is the package manager, test runner, and server runtime. Never use
  npm/yarn/pnpm commands.
- mise is the task runner and mirrors CI. App-running tasks (`dev`, `prod`,
  `test*`) are dockerized via the compose files; repo-management tasks
  (install, format, lint, type-check, build, clean) run locally.
- Biome owns formatting + linting: 4-space indent, single quotes, semicolons,
  100-char lines, sorted imports, `import type`/`export type` enforced, `any`
  banned. Biome does not ignore warnings away: fix the code.
- cspell checks markdown and code; new project words go into `cspell.json`,
  never inline suppression.
- lychee verifies every markdown link in CI; never leave a dead link.
- TODO/FIXME/BUG/HACK comments in pushed commits auto-open GitHub issues
  (`todo-issues.yml`); use them deliberately, not as leftover noise.

## Commands

Local quality gates, from the repo root:

    bun run check:ci       # biome lint + format check, CI mode
    bun run type-check     # tsc for all three packages
    bun run test:unit      # ~450 unit tests across shared/server/client
    bun run spellcheck     # cspell
    bun run check-links    # lychee

Dockerized app and test stacks: `mise run dev`, `mise run test`,
`mise run test-e2e`, `mise run test-api`. Full local CI mirror: `mise run ci`.

## Architecture in 60 seconds

1. **Shared-first.** Anything used by both sides belongs in
   `packages/shared/src/` (types, utils, errors, constants), re-exported from
   its `index.ts`. Server and client never redeclare shared concepts.
2. **Everything behind an interface.** Repositories, HTTP/WS servers, date,
   config, logging are adapter interfaces; implementations are wired in the
   DI `Container` (`packages/server/src/container.ts`,
   `packages/client/src/lib/container.ts`). Swapping an implementation means
   changing one line there and nowhere else.
3. **Request flow.** `routes/*` validate with Zod (the schemas also register
   into the OpenAPI doc served at `/openapi.json` and `/openapi.yaml`), call
   repos/services, and publish domain events on the `EventBus`.
   `WebSocketManager` fans events out to all clients except the originator
   (`x-client-id`). Handlers throw shared `AppError` subclasses; the route
   wrapper maps them to HTTP responses.
4. **Client data flow.** Stores are Svelte 5 runes classes (`*.svelte.ts`);
   services wrap `container.httpClient`; stores subscribe to
   `websocketService` and ingest broadcast events so every tab stays in sync.
5. **Storage.** `STORAGE_ADAPTER=memory|sqlite` (sqlite default). Raw SQL via
   `bun:sqlite`, no ORM, forward-only migrations in
   `packages/server/src/adapters/data/migrations/`. `bun build` does not
   bundle `.sql`; the build script copies `migrations/` into `dist/`.

## Hard rules

- Tests are mandatory: unit tests next to the code (`*.test.ts`),
  `tests/api-tests/` specs for endpoint behavior, e2e specs for user-visible
  behavior. Every test cleans up the entities it creates.
- Docs are living: behavior changes update the matching doc in the same
  commit. ADRs are immutable once accepted; a new decision gets a new ADR.
- Storybook stories (`.stories.ts`) accompany components.
- Client styling uses the Fizzy design tokens in `app.css`; light AND dark
  themes must both work.
- Conventional Commits, enforced by commitlint: `feat`, `fix`, `docs`,
  `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`;
  lowercase subject, no trailing period.
- No secrets, ever; gitleaks scans staged content at pre-commit.

## Environment warnings

- The docker dev stack owns ports 3000/4000, and another agent session often
  has work in progress in this repo concurrently. Before killing processes,
  starting servers, or touching anything stateful in git, read the
  `concurrent-git` skill.
- Bash redirects to `/dev/null` are denied by the local permissions
  extension. Use the edit tool for file changes; redirect to real files when
  output capture is needed.
- e2e has a known environmental flake: vite intermittently binds `::1` only,
  causing ERR_CONNECTION_REFUSED. Re-run a failing spec standalone before
  blaming code; only a standalone repro counts as a real failure.

## Skills

| Skill | Use it when |
|-------|-------------|
| `verify-changes` | After any change, before declaring work done or committing |
| `add-api-endpoint` | Adding or changing a server endpoint, service, or repo |
| `build-client-feature` | Client stores, components, keybindings, tooltips |
| `run-e2e` | Running Playwright and Bruno tests, isolated stacks, flake triage |
| `concurrent-git` | ANY stateful git operation when the tree/index holds another session's WIP |

Load a skill with `/skill:<name>` (pi) or by reading
`.agents/skills/<name>/SKILL.md` (any harness).