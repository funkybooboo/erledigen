# Testing

Testing strategy and tools for the Erledigen project. See also
[philosophy.md](philosophy.md) (the TDD red-green-refactor cycle) and
[tests/README.md](../../../tests/README.md) (how to run each suite, flake
triage, and the isolated verification stack).

## Principles

- **Test behavior, business logic, and user value** -- not implementation
  details. Tests must survive refactoring: assert observable outcomes, not
  call counts or private state.
- **Zero tolerance for flaky tests.** Tests must be deterministic,
  idempotent, order-independent, and parallel-safe. Flaky tests are broken
  code -- fix them immediately.
- **Real dependencies over mocks** (see [The NO MOCKS Policy](#the-no-mocks-policy)).
- **Every business rule has explicit test coverage.** Code without tests
  does not merge.

**Known environmental flake**: locally, vite occasionally binds `::1` only,
producing intermittent ERR_CONNECTION_REFUSED failures that rotate between
tests. Triage rule: re-run any connection-looking failure STANDALONE; only a
standalone repro counts as a real failure (see `tests/README.md` for the
isolated verification stack).

## The Three Layers

| Layer | Tool | Scope |
|-------|------|-------|
| Unit (the bulk) | `bun test` | Pure functions, validators, domain rules, parsers -- no I/O, no mocks |
| Integration | `bun test` + `bun:sqlite` | Repository adapters against a fresh `:memory:` SQLite database per test; contract suites run against BOTH adapters |
| E2E / API | Playwright (dockerized) + Bruno | Full user workflows in a browser; black-box HTTP against the real server |

### The Contract-Test Pattern

Every repository has a **contract test suite** that runs against BOTH the
in-memory and SQLite implementations, so the two adapters can never drift
(the adapters are NOT behaviorally identical -- see the Bun gotchas in
[code-standards.md](code-standards.md)). This is the actual repo convention:

```typescript
// contracts/taskRepositoryContract.ts exports runTaskRepositoryContractTests(makeRepo)
// and both adapters run the exact same suite:
import { SqliteTaskRepository } from './SqliteTaskRepository';
import { SqliteConnection } from './sqliteConnection';
import { NativeDateProvider } from '@erledigen/shared';
import { runTaskRepositoryContractTests } from './contracts/taskRepositoryContract';

// Fresh :memory: database per test - full isolation, no file cleanup needed.
function makeRepo() {
    const connection = new SqliteConnection(':memory:');
    return new SqliteTaskRepository(connection.db, new NativeDateProvider());
}

describe('SqliteTaskRepository', () => {
    runTaskRepositoryContractTests(makeRepo);
});
```

Any repository-behavior change must extend the contract suites -- a change
verified against only one adapter will surprise the other in production.

## Tools

### Bun Test Runner (unit + integration)

```bash
bun test                    # all unit/integration tests
bun test math.test.ts       # one file
bun test --watch            # watch mode
bun test --coverage         # coverage
```

Tests use descriptive, behavior-focused names ("when X, then Y") and the
Arrange-Act-Assert structure.

### Playwright (e2e + api projects)

Browser e2e specs plus a black-box `api` project that drives the real Bun
server (`STORAGE_ADAPTER=memory`) over HTTP. Runs dockerized via
`mise run test-e2e`; local `bun run test:e2e` auto-starts an ephemeral
in-memory server. See [tests/README.md](../../../tests/README.md) before
running locally -- the dockerized stack is the reliable path, and two
Playwright sessions against one server pollute each other.

E2E specs must wait for a POSITIVE readiness signal before acting: the
`hydrated(page)` helper (layout sets `data-hydrated="true"` in `onMount`) or
a seeded row becoming visible. Never use a negative assertion
(`not.toHaveClass`) as a readiness wait -- it passes vacuously on a missing
element.

### Bruno (API collection)

The Bruno collection in `tests/api/` covers the REST surface with
git-friendly `.bru` files. Run via the GUI (open the collection, `local`
environment) or CLI:

```bash
cd tests/api && bru run --env local
```

## The NO MOCKS Policy

**NEVER use mocks.** Mocks test implementation details, create false
confidence, and break during refactoring. Use instead:

- **Real adapter implementations** -- in-memory repositories, or SQLite
  repositories on a fresh `:memory:` database
- **The real server** -- the Playwright `api` project and Bruno both hit the
  actual Bun server end to end
- **A test `DateProvider`** for deterministic dates

The only acceptable test doubles are hand-written test adapter
implementations for external APIs you don't control -- never `jest.fn`-style
call spies.

## Quality Gates

All of the following must pass before merging (CI enforces them; see
[ci-cd-pipeline.md](../process/ci-cd-pipeline.md)):

1. Unit + integration tests (including both adapter contract suites)
2. Playwright e2e + api projects
3. Bruno API collection
4. Biome lint/format
5. TypeScript strict type-check
6. Secret scan + link check + spell check
7. Build + client bundle-size budget (576 KiB, browser payload)

Accessibility and performance suites are planned (axe-core integration is on
the roadmap); the gates above are what is enforced today.

```bash
mise run test          # unit tests (dockerized)
mise run test-e2e      # Playwright e2e + api (docker test stack)
mise run test-api      # Bruno collection
mise run test-all      # Bruno + Playwright together
mise run ci            # full local CI mirror
```
