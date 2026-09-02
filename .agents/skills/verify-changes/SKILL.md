---
name: verify-changes
description: Run Erledigen's quality gates in escalation order for the scope of the change -- biome, type-check across all three packages, unit tests, Playwright api/e2e and Bruno tests, and the markdown gates (cspell, lychee). Use after ANY code or docs change, before declaring work done or committing.
---

# Verify Changes

Quality gates in escalation order. Run every level your change touches; all
must be green before committing. Commands run from the repo root. Everything
here is fast and local; the dockerized variants (`mise run test`,
`mise run test-e2e`) exist for CI parity, not the feedback loop.

## Level 1: lint + format (every change)

    bun run check:ci        # CI mode: no writes, nonzero exit on any issue
    bun run check           # auto-fix while iterating

Biome owns style: 4-space indent, single quotes, semicolons, 100-char lines.
Import sorting is part of the check. Fix findings in code, never suppress.

## Level 2: types (every code change)

    bun run type-check      # shared + server + client (svelte-kit sync && tsc)

All three packages must report 0 errors.

## Level 3: unit tests (every code change)

    bun run test:unit       # all three packages, a couple of seconds total
    bun run test:unit:shared    # or per package while iterating
    bun run test:unit:server
    bun run test:unit:client

Currently about 450 tests (shared ~134, server ~299, client ~17). Counts drift
as tests are added; report what you see, never assume a number.

## Level 4: HTTP + browser tests (routes or user-visible behavior changed)

See the `run-e2e` skill for the full playbook, including isolated stacks:

    bun run test:e2e:api    # Playwright `api` project, black-box HTTP on :4000
    bun run test:e2e:ui     # Playwright `e2e` project, browser on :3000
    bun run test:api        # Bruno collection, tests/api/*.bru

Coverage duties: a new endpoint or API behavior needs a spec in
`tests/api-tests/<resource>.spec.ts` (plus a `.bru` request where the Bruno
collection covers that resource); new user-visible behavior needs an e2e spec
in `tests/e2e/<area>.spec.ts`.

## Level 5: markdown gates (any `.md` touched)

    bun run spellcheck      # cspell; new project words go in cspell.json
    bun run check-links     # lychee; relative links must resolve

Never silence cspell inline; add genuine project terms to `cspell.json`. Any
markdown link added or kept must resolve; dead links fail CI.

## Committing

Pre-commit hooks run on staged files only: lint-staged (biome check --write,
cspell) and gitleaks `protect --staged`; commitlint validates the message
(Conventional Commits: feat, fix, docs, style, refactor, perf, test, build,
ci, chore, revert; lowercase subject, no trailing period).

If the tree or index holds another session's WIP, follow the `concurrent-git`
skill for any git operation.