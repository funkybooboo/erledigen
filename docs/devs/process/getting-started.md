# Getting Started

Welcome to Erledigen! This guide will walk you through setting up your development environment and running the application.

## Prerequisites

Before you begin, make sure you have the following installed:

- [mise](https://mise.jdx.dev) -- the project's task runner and tool version manager (Bun, lychee, and gitleaks are managed automatically by mise)
- Docker (or podman + a `docker` wrapper) with compose support -- the dev, prod, and test stacks all run in containers

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

This starts the docker dev stack (server + client, attached). Source is bind-mounted, so code edits are picked up live by `bun --watch` (server) and vite HMR (client) -- no rebuild needed. The dev database lives in the `dev-data` named volume, never in the repo. After changing dependencies, run `mise run dev-refresh` to rebuild the dev images.

> The dev stack publishes ports 3000/4000 on the host -- stop any locally-running servers first (the `predev` bun script does this when running outside docker).
>
> **These scripts kill whatever holds ports 3000/4000, without asking**:
> `predev` (3000+4000) and `pretest:e2e*` (4000). Never run them while a dev
> stack or manual server on those ports belongs to someone else -- check
> `lsof -ti:3000,4000` first. (The prod stack never collides: single
> published port, default 8080. `mise run ci` no longer starts or kills any
> local servers -- its tests run in the dockerized test stack.)

### Run one service at a time

The dev stack's services are just compose services -- start either one
attached directly (no dedicated mise task for this):

```bash
docker compose up server
docker compose up client
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
*   **Storybook**: `http://localhost:6006` (`mise run storybook` -- local, not dockerized)

## Available Tasks

All tasks are run via `mise run <task>` (pass arguments with `mise run <task> -- <args>`). App-running tasks (dev, prod, tests) execute in containers and never touch your host environment; repo-management tasks (install, format, lint, type-check, build, clean, ci) run locally against the working tree. Anything with real logic behind it lives in the `tools/` scripts (build, build-images, clean, update-version, release, test-stack, ci) -- mise tasks are thin aliases over those, so you can also call the scripts directly.

### Dependencies
| Task | Description |
|------|-------------|
| `mise run install` | Install all dependencies (`bun install`) |
| `mise run install-ci` | Install with a frozen lockfile (what CI uses) |
| `mise run install-playwright` | Install Playwright browsers (local runs only; the docker test image bundles Chromium). Arch Linux hosts: run `tools/setup-playwright-arch.sh` first -- it bridges the system libs Playwright's browsers expect |

### Dev / prod servers (dockerized)
| Task | Description |
|------|-------------|
| `mise run dev` | Start the docker dev stack (server + client, attached) |
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

### Build / clean / CI / release / maintenance
| Task | Description |
|------|-------------|
| `mise run build` | Build the app packages locally (shared + server via bun build, client via vite) + client bundle-size budget (`tools/build.sh`) |
| `mise run build-images` | Build docker images without starting a stack: `dev` / `test` / `prod` / `all` (`tools/build-images.sh`) |
| `mise run build-storybook` | Build Storybook |
| `mise run clean` | Remove all build artifacts, caches, and node_modules (`tools/clean-repo.sh`; `-n` for a dry run) |
| `mise run ci` | Full local CI mirror -- mirrors GitHub Actions, fully dockerized tests (`tools/ci.sh`) |
| `mise run update-version` | Bump the version in all four package.json files + bun.lock: `major` / `minor` / `patch` / `X.Y.Z` (`tools/update-version.sh`) |
| `mise run release` | Cut a release: quality gates + version bump + release commit + annotated tag (`tools/release.sh`; `--full` adds the dockerized integration suite, `--push` pushes) |
| `mise run doctor` | Pre-flight environment check: tool pins, cross-file version sync (mise.toml/Dockerfile/bun.lock), docker, ports, repo state (`tools/doctor.sh`) |
| `mise run update-deps` | Update dependencies the safe way (per-workspace `bun update`; `--fresh` re-resolves the lockfile to pull transitive fixes; gates after) (`tools/update-deps.sh`) |
| `mise run changelog` | Generate release notes from the commit log; `--write` prepends the section to CHANGELOG.md (`tools/changelog.sh`) |

---

## Contributing

- **Bug reports**: [Open an issue](https://github.com/funkybooboo/erledigen/issues) with as much detail as possible.
- **Feature requests**: [Open an issue](https://github.com/funkybooboo/erledigen/issues) to discuss the idea first.
- **Pull requests**: Fork the repo, create a branch, make your changes, run `bun run validate`, then submit a PR. See [git-workflow.md](../standards/git-workflow.md) for branching conventions and commit standards.
