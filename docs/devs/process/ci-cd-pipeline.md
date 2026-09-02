# CI/CD Pipeline

The quality gates, automated checks, and deployment story for Erledigen. The
real workflow lives in [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml)
and is mirrored locally by `mise run ci`.

## Quality Gates

Merging to `main` is blocked unless all gates pass:

| Gate | Task | What it checks |
|------|------|----------------|
| Lint + format | `mise run biome-check` | Biome in CI mode (no auto-fix): lint, formatting, import order |
| Hygiene | `mise run spellcheck` / `check-links` / `scan-secrets` | cspell over the codebase, lychee over markdown/source links, gitleaks over the tree |
| Types | `mise run type-check` | TypeScript strict mode across all three packages (tsc for shared/server; svelte-kit sync + tsc for client) |
| Unit tests | `mise run test` | All Bun unit tests (dockerized); repository contract suites run against BOTH adapters, so SQL bugs are caught here |
| E2E | `mise run test-e2e` | Playwright browser specs + black-box `api` project against the self-contained docker test stack (`compose.test.yaml`, `STORAGE_ADAPTER=memory`, bundled Chromium); 1 retry allowed |
| API | `mise run test-api` | The Bruno collection in `tests/api/` against the dockerized test server |
| Build | `mise run build` | All packages compile; client bundle <= 512KB |
| Storybook | `mise run build-storybook` | Storybook builds |
| Security | `mise run security` | `bun audit` -- `continue-on-error`: advisories surface for review without blocking merges |

## GitHub Actions Workflow

Every job installs mise (which pins Bun/lychee/gitleaks) and dependencies
via `mise run install-ci` (frozen lockfile), then:

| Job | Steps |
|-----|-------|
| `quality-checks` | `biome-check` -> `spellcheck` -> `check-links` -> `scan-secrets` -> `type-check` (<= 10 min) |
| `unit-tests` | `mise run test` (dockerized Bun unit tests) |
| `e2e-tests` | start server + client, then `mise run test-e2e`; report uploaded as artifact on failure |
| `api-tests` | start server, then `mise run test-api` (Bruno) |
| `build` | `mise run build` + client bundle <= 512KB check |
| `storybook-build` | `mise run build-storybook` |
| `security` | `mise run security` (`bun audit`, `continue-on-error`) |
| `all-checks` | gate job -- fails if any required job failed or was cancelled |

## Deployment

There is no `deploy.yml` yet: Erledigen is self-hosted via

```bash
docker compose -f compose.prod.yaml up -d --build
```

-- a single published port (default 8080) behind a Caddy proxy; see the root
[README](../../../README.md) and `mise run prod` / `prod-logs` / `prod-stop`.
A staged deployment workflow (build artifact -> deploy -> smoke test) is the
target design if a hosted deployment is ever added.

## Local Mirror

`mise run ci` runs everything CI runs, including e2e + api + build + the
bundle-size check. Run it before opening a PR. Note the port warning in
[getting-started.md](getting-started.md): CI scripts kill whatever holds
ports 3000/4000, without asking.
