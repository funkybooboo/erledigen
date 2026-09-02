# Erledigen

Welcome to Erledigen, a modern task application that's as fun to develop as it is to use! Inspired by the clean and simple interface of TeuxDeux, Erledigen is a unified task manager built around one idea: **you should only need one place to manage your work and your life**.

The daily list is the execution surface. Someday is the capture net. Habits generate instances into the daily list automatically (projects will too, once auto-distribution lands). Everything is organized with tags -- the same tag system works across tasks, groups, Someday, and filters.

[![CI](https://github.com/funkybooboo/erledigen/actions/workflows/ci.yml/badge.svg)](https://github.com/funkybooboo/erledigen/actions/workflows/ci.yml)

---

## What's Inside?

Erledigen is a **monorepo** built with a modern tech stack designed for a great developer experience:

*   **Frontend**: [SvelteKit](https://kit.svelte.dev/) + [Svelte 5 runes](https://svelte.dev/) + [Tailwind CSS v4](https://tailwindcss.com/) -- a fast, modern, reactive UI.
*   **Backend**: [Bun](https://bun.sh/) -- an incredibly fast JavaScript runtime, bundler, and package manager, all in one.
*   **Language**: [TypeScript](https://www.typescriptlang.org/) -- end-to-end type safety.
*   **Real-time**: WebSocket sync -- every mutation broadcasts to all connected clients instantly.
*   **API**: Schema-first [OpenAPI 3.1](https://www.openapis.org/) generated from Zod, served at `/openapi.yaml` and `/openapi.json`.
*   **Architecture**: [Adapter Pattern](./docs/devs/architecture/architecture.md) -- a clean, modular architecture where every subsystem is behind an interface, so implementations can be swapped without touching application code.
*   **Code Quality**: [Biome](https://biomejs.dev/) -- formatting and linting.
*   **Testing**: [Bun test](https://bun.sh/docs/cli/test) for units, [Playwright](https://playwright.dev/) for E2E, and [Bruno](https://www.usebruno.com/) for API tests.
*   **Components**: [Storybook](https://storybook.js.org/) -- isolated component development and visual review.

## Key Features

*   **Daily list** -- the primary working area; a continuously-scrolling list of day sections (loads more days as you scroll) with inline add/edit and a month minimap for orientation.
*   **Someday panel** -- a right-side capture net for unscheduled work, organized into tag-based groups; drag-to-resize and collapsible (`Cmd/Ctrl+\\`).
*   **Tags as the primary organization** -- `#p1`/`#p2`/`#p3` priority, `project:`-prefixed project tags, and any free-form tags. One filter system covers everything.
*   **Projects** -- collections of ordered tasks with activate/deactivate and a detail view.
*   **Habits / recurring tasks** -- natural-language templates ("water plants every friday at 9am") that generate instances into the daily list, with streak tracking and a management modal.
*   **Sub-tasks** -- nested tasks under a parent; completion rolls up.
*   **Command palette** (`Cmd/Ctrl+K` or `/`) -- fuzzy search across tasks plus a `/`-prefixed command mode (currently `/add`, with habit phrases like "every day" creating habits).
*   **Keyboard-first + tooltips** -- vim + arrow navigation, `g`-sequences for modals, priority keys `1`/`2`/`3`/`0`, `Cmd/Ctrl+Z` undo; every UI action shows its keybinding on hover.
*   **Icon-rail modals** -- Calendar, Summary, Projects, Habits, Search, Filter, Settings, Trash, Help.
*   **Trash with undo** -- soft delete with a 5s undo toast, restore from Trash, and purge of soft-deleted tasks after 7 days.
*   **Privacy first** -- no analytics, no telemetry, no tracking. Your data stays in your own database.

## Getting Started

This project uses [mise](https://mise.jdx.dev) as its task runner and tool version manager. Install it first, then:

1.  **Install dependencies**:

    ```bash
    mise run install
    ```

2.  **Run the development servers** (requires Docker / podman + compose):

    ```bash
    mise run dev
    ```

That's it! The client runs at `http://localhost:3000` and the server at `http://localhost:4000`.

### Common tasks

| Command | What it does |
|---------|--------------|
| `mise run dev` | Start the docker dev stack (server + client) |
| `mise run prod` / `mise run prod-stop` | Build + start / stop the docker prod stack |
| `mise run dev-refresh` | Rebuild dev images after changing dependencies |
| `mise run storybook` | Start Storybook on port 6006 (local, not dockerized) |
| `mise run check` | Lint + format with Biome (auto-fix) |
| `mise run spellcheck` | Spell-check the codebase with cspell |
| `mise run check-links` | Verify all markdown/source links resolve (lychee) |
| `mise run scan-secrets` | Scan for secrets in the working tree (gitleaks) |
| `mise run type-check` | Type-check all packages |
| `mise run test` | Run all unit tests in a container |
| `mise run test-e2e` | Run Playwright E2E + api tests in the docker test stack |
| `mise run test-api` | Run Bruno API tests in the docker test stack |
| `mise run build` | Build the app packages locally (artifacts in the repo) + bundle-size budget |
| `mise run build-images` | Build docker images without starting a stack: dev / test / prod / all |
| `mise run update-version` | Bump the version everywhere (major / minor / patch / X.Y.Z) |
| `mise run release` | Cut a release: gates + version bump + release commit + tag |
| `mise run doctor` | Pre-flight environment check (tools, versions, docker, ports, repo state) |
| `mise run update-deps` | Update dependencies the safe way (in-place; `--fresh` re-resolves for transitive fixes) |
| `mise run changelog` | Generate release notes from the commit log |
| `mise run ci` | Run the full local CI mirror (local, mirrors GitHub Actions) |
| `mise run clean` | Remove build artifacts and caches |

App-running tasks (dev, prod, tests) execute in containers and never touch
your host environment. Repo-management tasks (install, format, lint,
type-check, build, clean, ci) run locally against the working tree, because
they manage the repo itself.

## Docker

One multi-stage `Dockerfile` at the repo root; compose picks the stage via
`build.target`:

| Stage | Used by | What it is |
|-------|---------|------------|
| `development` | `server`, `client` (dev), all test services | bun + workspace deps + source |
| `production-server` | `prod-server` | minimal bun runtime + server bundle |
| `production-client` | `prod-client` | node runtime + SvelteKit adapter-node build |
| `e2e` | `e2e` runner (test stack) | mcr.microsoft.com/playwright + bun + source |

**Dev** (`compose.yaml`, default): source is bind-mounted, so code edits are
picked up live by `bun --watch` (server) and vite HMR (client) -- no rebuild
needed. `node_modules` are shielded from the bind mount by anonymous volumes
seeded from the image; after changing dependencies run `mise run dev-refresh`.
The dev DB lives in the `dev-data` named volume (`DB_PATH=/data`), never in
the repo.

**Prod** (`docker compose --profile prod up -d --build`): built artifacts
only, no bind mounts. `VITE_API_URL` is baked into the client bundle at build
time -- override it (e.g. `VITE_API_URL=https://api.example.com docker compose
--profile prod up -d --build`) when deploying for real. Prod publishes the
same ports as dev, so stop dev first. Server data persists in the `prod-data`
named volume.

**Tests** (`compose.test.yaml`): fully self-contained -- no bind mounts, no
named volumes, nothing written to the host. Source is baked into the images,
the test server runs with `STORAGE_ADAPTER=memory`, and the Playwright runner
uses the Chromium bundled in the mcr image (no `playwright install` needed
locally, no browsers polluting your machine).

Version pins to keep in sync:

- `BUN_VERSION` in the `Dockerfile` must match `[tools] bun` in `mise.toml`.
- `PLAYWRIGHT_VERSION` in the `Dockerfile` must match the `@playwright/test`
  version in `bun.lock` -- bump both together or the bundled browsers fail
  version validation.

> **Note (this machine):** `docker` here is a `podman` wrapper (rootless,
> fuse-overlayfs storage). The podman `storage.conf` fix that makes
> `docker compose build` work on btrfs lives in the dotfiles
> (`~/.config/containers/storage.conf`) -- `mount_program` must be set under
> `[storage.options.overlay]`, not `[storage.options]`.

## Monorepo Layout

```
erledigen/
|-- packages/
|   |-- client/   # SvelteKit frontend (Tailwind CSS, Svelte 5 runes)
|   |-- server/   # Bun REST API + WebSocket server
|   \-- shared/   # Types, adapter interfaces, constants, universal utilities
|-- docs/         # User + developer documentation, ADRs
|-- tests/        # Playwright E2E + Bruno API test suites
|-- plans/        # Roadmap and planning docs
\-- package.json
```

## Learn More

*   [**Introduction**](./docs/users/introduction.md) -- a brief introduction to the project.
*   [**Product Design**](./docs/users/design.md) -- the full product vision, data model, and feature set.
*   [**Getting Started**](./docs/devs/process/getting-started.md) -- detailed setup and run instructions.
*   [**Architecture**](./docs/devs/architecture/architecture.md) -- overview of the project's architecture.
*   [**Code Standards**](./docs/devs/standards/code-standards.md) -- writing clean, consistent, maintainable code.
*   [**Testing**](./docs/devs/standards/testing.md) -- testing strategies and tools.
*   [**Git Workflow**](./docs/devs/standards/git-workflow.md) -- how we work with git and pull requests.
*   [**Roadmap**](./plans/roadmap.md) -- release-by-release development plan.

## Contribute

We'd love for you to join us! Whether you're a seasoned developer or just starting out, there are many ways to contribute to Erledigen. Check out our [**Getting Started**](./docs/devs/process/getting-started.md) guide to learn more.

---

Happy coding!
