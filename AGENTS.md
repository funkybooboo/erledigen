# AGENTS.md

Erledigen — self-hosted task app (daily list + Someday panel + habits).
Monorepo: `packages/shared` (types, utils, errors, adapter interfaces used by
both sides), `packages/server` (Bun HTTP + WS), `packages/client` (SvelteKit +
Svelte 5 runes).

This file is only a router. Every piece of project knowledge — workflow,
standards, architecture, gotchas — lives in the documentation, shared by
humans and agents alike. Do not add content here; update the docs and keep
these pointers accurate.

## Start here

- Doc index: [docs/devs/README.md](docs/devs/README.md)
- Workflow — `wt` worktrees, branches, pull requests, commit rules:
  [docs/devs/standards/git-workflow.md](docs/devs/standards/git-workflow.md)
- How everything runs (mise tasks, docker stacks, ports):
  [mise.toml](mise.toml), [README.md](README.md),
  [docs/devs/process/getting-started.md](docs/devs/process/getting-started.md)
- Test layers and how to run them: [tests/README.md](tests/README.md)
- Conventions: [code-standards.md](docs/devs/standards/code-standards.md) and
  [testing.md](docs/devs/standards/testing.md)
- Architecture and ADRs: [architecture.md](docs/devs/architecture/architecture.md)
  (ADRs are immutable; a new decision gets a new ADR)

## Read before working in an area

- Client (`packages/client`) — Svelte 5 gotchas that have shipped bugs here:
  "Svelte-Specific Standards" in code-standards.md
- Server, data layer, or parsers — Bun/runtime gotchas: "Bun Runtime
  Gotchas" in code-standards.md
- Domain model, API routes, stores, realtime — surprising domain facts:
  "Domain Model Notes" in architecture.md
- Running tests or e2e — flake triage and the isolated verification stack:
  "Notes" in tests/README.md
- Sharing a checkout with another session (avoid; use `wt`) — safety rules:
  "Appendix: Sharing a Single Checkout" in git-workflow.md