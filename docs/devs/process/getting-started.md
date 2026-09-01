# Getting Started

Welcome to Erledigen! This guide will walk you through setting up your development environment and running the application.

## Prerequisites

Before you begin, make sure you have the following installed:

- [mise](https://mise.jdx.dev) — the project's task runner and tool version manager (Bun, lychee, and gitleaks are managed automatically by mise)
- Docker (or podman + a `docker` wrapper) with compose support — the dev, prod, and test stacks all run in containers

```bash
# Install mise (macOS with Homebrew)
brew install mise

# Activate mise in your shell (add to ~/.bashrc, ~/.zshrc, or ~/.config/fish/config.fish)
mise activate
```

Once mise is installed, it will automatically use the tool versions defined in `mise.toml`.

## Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/funkybooboo/erledigen.git
    cd erledigen
    ```

2.  **Install dependencies:**

    ```bash
    mise run install
    ```

## Configuration

Containers get their configuration from compose environment entries with `${VAR:-default}` overrides, so no `.env` file is required to start. For local (non-docker) runs, there are `.env.example` files in `packages/client` and `packages/server` you can copy:

```bash
cp packages/server/.env.example packages/server/.env
cp packages/client/.env.example packages/client/.env
```

The relevant variables:

| Variable | Where | Default | Purpose |
|----------|-------|---------|---------|
| `PORT` | server | `4000` | API/WebSocket server port |
| `CORS_ORIGIN` | server | `*` | CORS allowed origins |
| `STORAGE_ADAPTER` | server | `sqlite` | `sqlite` (persistent) or `memory` (ephemeral; forced in test runs) |
| `DB_PATH` | server | `./data/erledigen.db` (dev container: `/data/erledigen.db`) | SQLite database file |
| `RATE_LIMIT_RPM` | server | `600` | Requests per minute per client |
| `VITE_API_URL` | client | `http://localhost:4000` | API server URL the browser uses |
| `VITE_PORT` | client | `3000` | Client dev server port |

## Running the Application

The app runs in containers; `mise run dev` is the easiest way to start:

```bash
mise run dev
```

This starts the docker dev stack (server + client, attached). Source is bind-mounted, so code edits are picked up live by `bun --watch` (server) and vite HMR (client) — no rebuild needed. The dev database lives in the `dev-data` named volume, never in the repo. After changing dependencies, run `mise run dev-refresh` to rebuild the dev images.

> The dev stack publishes ports 3000/4000 on the host — stop any locally-running servers first (the `predev` bun script does this when running outside docker).

### Run one service at a time

```bash
mise run server   # docker compose up server
mise run client   # docker compose up client
```

### Production stack

```bash
mise run prod        # build + start (detached), single published port (default 8080, behind Caddy)
mise run prod-logs   # follow logs
mise run prod-stop   # stop (prod-data volume is kept)
```

## Development URLs

*   **Client**: `http://localhost:3000`
*   **Server**: `http://localhost:4000`
*   **Health Check**: `http://localhost:4000/api/health`
*   **OpenAPI spec**: `http://localhost:4000/openapi.json` (or `/openapi.yaml`)
*   **Storybook**: `http://localhost:6006` (`mise run storybook` — local, not dockerized)

## Available Tasks

All tasks are run via `mise run <task>`. App-running tasks (dev, prod, tests) execute in containers and never touch your host environment; repo-management tasks (install, format, lint, type-check, build, clean, ci) run locally against the working tree.

### Dependencies
| Task | Description |
|------|-------------|
| `mise run install` | Install all dependencies (`bun install`) |
| `mise run install-ci` | Install with a frozen lockfile (what CI uses) |
| `mise run install-playwright` | Install Playwright browsers (local runs only; the docker test image bundles Chromium) |

### Dev / prod servers (dockerized)
| Task | Description |
|------|-------------|
| `mise run dev` | Start the docker dev stack (server + client, attached) |
| `mise run client` / `mise run server` | Start just one dev container |
| `mise run dev-refresh` | Rebuild dev images and recreate dev containers (after changing dependencies) |
| `mise run prod` / `mise run prod-stop` / `mise run prod-logs` | Build+start / stop / follow the docker prod stack |
| `mise run storybook` | Start Storybook (port 6006, local) |

### Code quality (local)
| Task | Description |
|------|-------------|
| `mise run format` | Format all files with Biome (auto-fix) |
| `mise run lint` | Lint all files with Biome (auto-fix) |
| `mise run biome-check` | Check lint + format without auto-fix (CI mode) |
| `mise run spellcheck` | Spell-check the codebase with cspell |
| `mise run check-links` | Verify all markdown/source links resolve (lychee) |
| `mise run scan-secrets` | Scan the working tree for secrets (gitleaks) |
| `mise run type-check` | Type-check all packages |
| `mise run security` | Run `bun audit` |

### Testing
| Task | Description |
|------|-------------|
| `mise run test` | Run all unit tests in a container |
| `mise run test-e2e` | Run Playwright e2e + api tests in the docker test stack |
| `mise run test-api` | Run Bruno API tests against the dockerized test server |
| `mise run test-all` | Run Bruno API + Playwright e2e tests in the docker test stack |
| `mise run test-watch` | Run unit tests in watch mode (local) |
| `mise run test-coverage` | Run unit tests with coverage (local) |

The docker test stack (`compose.test.yaml`) is fully self-contained: no bind mounts, no named volumes, `STORAGE_ADAPTER=memory`, and the bundled Chromium from the Playwright image. Local Playwright runs (`bun run test:e2e`) auto-start an ephemeral in-memory server; `bun run test:e2e:no-server` skips spawning servers and attaches to an already-running stack.

### Build / clean / CI
| Task | Description |
|------|-------------|
| `mise run build` | Build all packages (shared + server via bun build, client via vite) |
| `mise run build-storybook` | Build Storybook |
| `mise run clean` | Remove build artifacts, caches, and node_modules |
| `mise run ci` | Full local CI mirror (mirrors GitHub Actions, incl. e2e + api + build + bundle-size check) |

---

## Contributing

- **Bug reports**: [Open an issue](https://github.com/funkybooboo/erledigen/issues) with as much detail as possible.
- **Feature requests**: [Open an issue](https://github.com/funkybooboo/erledigen/issues) to discuss the idea first.
- **Pull requests**: Fork the repo, create a branch, make your changes, run `bun run validate`, then submit a PR. See [git-workflow.md](../standards/git-workflow.md) for branching conventions and commit standards.
