# Architecture

This document provides a high-level overview of the architecture of the Erledigen application. Our architecture is designed to be modular, scalable, and easy to maintain.

## Monorepo

Erledigen is a monorepo managed with [Bun Workspaces](https://bun.sh/docs/pm/workspaces). This means that the client, server, and shared code are all in the same repository, but are treated as separate packages.

### Project Structure

```
erledigen/
|-- packages/
|   |-- client/          # SvelteKit frontend
|   |-- server/          # Bun API server
|   \-- shared/          # Shared types and utilities
|-- docs/                # Project documentation
|-- tests/               # Playwright api/e2e suites + Bruno collection
|-- plans/               # Roadmap and planning docs
\-- package.json         # Root workspace config
```

*   **`packages/client`**: A SvelteKit application.
*   **`packages/server`**: a Bun HTTP server that exposes a REST API.
*   **`packages/shared`**: A package that contains code shared between the client and server, such as types, interfaces, and constants.

## The Adapter Pattern

A cornerstone of our architecture is the **adapter pattern**. This pattern allows us to decouple our application's core logic from the specific implementations of its dependencies. We define a generic interface (the "port") in our application, and then create concrete implementations (the "adapters") for different technologies or environments.

### Core Adapters

*   **`ConfigProvider`**: Abstracts access to configuration.
    *   **`ViteConfigProvider`** (client): Reads configuration from `import.meta.env`.
    *   **`EnvConfigProvider`** (server): Reads configuration from `process.env`.
*   **`HttpClient`**: Abstracts HTTP communication.
    *   **`FetchHttpClient`** (shared): A universal implementation using the `fetch` API.
*   **`Logger`**: Abstracts logging.
    *   **`ConsoleLogger`** (shared): A simple implementation that logs to the console.
*   **`HttpServer`**: Abstracts the underlying HTTP server.
    *   **`BunHttpServer`** (server): An implementation using Bun's native HTTP server.
*   **`TaskRepository`**: Abstracts data persistence for tasks.
    *   **`InMemoryTaskRepository`** (server): An in-memory implementation for development and testing.
    *   **`SqliteTaskRepository`** (server): SQLite-backed persistence (v0.7.0+, see [ADR-001](decisions/ADR-001-sqlite-raw-sql-persistence.md)).
*   **`ProjectRepository`**: Abstracts data persistence for projects.
    *   **`InMemoryProjectRepository`** (server): An in-memory implementation.
    *   **`SqliteProjectRepository`** (server): SQLite-backed persistence.
*   **`RecurringTaskRepository`**: Abstracts data persistence for recurring task templates and stats.
    *   **`InMemoryRecurringTaskRepository`** (server): An in-memory implementation.
    *   **`SqliteRecurringTaskRepository`** (server): SQLite-backed persistence.
*   **`SomeDayGroupRepository`**: Abstracts data persistence for Someday panel groups.
    *   **`InMemorySomeDayGroupRepository`** (server): An in-memory implementation.
    *   **`SqliteSomeDayGroupRepository`** (server): SQLite-backed persistence.
*   **`UserPreferencesRepository`**: Abstracts data persistence for user settings.
    *   **`InMemoryUserPreferencesRepository`** (server): An in-memory singleton implementation.
    *   **`SqliteUserPreferencesRepository`** (server): SQLite-backed persistence.
*   **`MetricsAdapter`**: Abstracts metrics collection -- **planned**, see [ADR-005](decisions/ADR-005-prometheus-metrics.md) (accepted, not yet implemented).
*   **`JobQueue`**: Abstracts background job scheduling and processing -- **planned**, see [ADR-002](decisions/ADR-002-sqlite-backed-job-queue.md) (accepted, not yet implemented). Recurring-task generation currently happens on demand (client-driven) instead of via jobs.

### Benefits of the Adapter Pattern

*   **Flexibility**: We can easily swap out implementations without changing our application's code. For example, the `STORAGE_ADAPTER` env var swaps the in-memory repositories for SQLite-backed ones (see [ADR-001](decisions/ADR-001-sqlite-raw-sql-persistence.md)) -- no application code changes.
*   **Testability**: We can easily substitute our dependencies in tests. For example, the same contract suites run against the in-memory repositories and a fresh `:memory:` SQLite database (see the contract-test pattern in [testing.md](../standards/testing.md)) -- no mocks required.
*   **Maintainability**: The separation of concerns makes our code easier to understand, maintain, and reason about.

## Dependency Injection

We use a simple dependency injection (DI) container to manage our application's dependencies. The container is responsible for creating and providing instances of our adapters.

```typescript
// packages/server/src/container.ts
export const container = new Container()

// Repositories are lazy getters; the STORAGE_ADAPTER env var (sqlite by
// default, memory for ephemeral/test runs) picks InMemory* vs Sqlite*
// implementations -- see container.initStorage().
const taskRepo = container.taskRepository
```

This approach allows us to easily manage the lifecycle of our dependencies and provides a central place to configure our application.

## The Shared Package (`@erledigen/shared`)

The `@erledigen/shared` package is the secret sauce that enables type-safe, end-to-end communication between our client and server. It contains all the code that is shared between the two, including:

*   **Types**: All of our data models, such as `Task` and `User`.
*   **API Contracts**: The request and response types for our API endpoints.
*   **Constants**: Shared constants like API routes and validation rules.
*   **Interfaces**: The adapter interfaces described above.
*   **Universal Implementations**: Implementations of our adapters that can run in both the browser and Bun (e.g., `FetchHttpClient`).

### The Golden Rule of the Shared Package

When deciding whether to put a piece of code in the `@erledigen/shared` package, ask yourself this question:

> **Does the client need this code?**

If the answer is **no**, put it in the `packages/server`. If the answer is **yes**, then ask:

> **Does the server also need this code?**

If the answer is **yes**, put it in `packages/shared`. If the answer is **no**, put it in `packages/client`.

This simple rule ensures that our shared package remains lean and that we maintain a clear separation of concerns.

## Domain Model Notes

Facts that are easy to get wrong when working on the domain, API, or stores.

- **Tags ARE the domain model, not metadata.** Priority is not a field:
  `p1`/`p2`/`p3` are tags resolved through the tag-kind system
  (`packages/shared/src/utils/tagKinds.ts`, `DEFAULT_TAG_KIND_MAP`); projects
  own a `project:`-prefixed tag kind. Free-form tags organize tasks, groups,
  Someday, and filters alike.
- **Dates are local key strings.** A task's `date` is a `yyyy-MM-dd` string in
  local time; `date === null` means the task lives in Someday. Date math goes
  through the shared `dateProvider` key helpers -- never `Date` object
  arithmetic (timezone bugs have shipped from that).
- **Habits materialize as real tasks, idempotently.** A recurring template
  stamps generated instances with its `recurringTaskId` and `startTime`;
  generation skips dates that already exist
  (`TaskRepository.findByRecurringTaskId`), so editing a schedule never
  rewrites already-created instances. Generation is client-driven on demand
  (DayList chunk loads; a +90-day horizon for new habits,
  `GENERATE_HORIZON_DAYS`) -- there is NO server-side scheduler; ADR-002's job
  queue remains unimplemented.
- **Realtime skips the originator twice, on purpose.** Mutations publish an
  event on the `EventBus` carrying the requester's `x-client-id`; the server
  broadcast skips that client's socket, AND the client additionally ignores
  messages whose `originClientId` matches its own id. Stores upsert by id
  on ingest so an echoed event cannot duplicate rows. Do not remove either
  skip layer "because the other covers it".
- **Literal routes must register before `:id` routes** (`/tasks/purge`,
  `/recurring-tasks/generate-all`) or the literal is parsed as the id.
- **Zod schemas self-register into the OpenAPI document on import**
  (zod-to-openapi): a schema referenced only by tests still shows up in
  `/openapi.json`.

## 12-Factor App Compliance

The application is designed to follow the principles of a [12-Factor App](https://12factor.net/). This means that it is:

*   **Stateless Processes**: The server processes are stateless. Persistent state lives in SQLite (see [ADR-001](decisions/ADR-001-sqlite-raw-sql-persistence.md)). In-memory repositories are for testing only.
*   **Configurable**: All configuration is stored in the environment (see `EnvConfigProvider`).
*   **Portable**: It can be easily run in different environments -- local dev, Docker, or bare metal.
*   **Scalable**: The adapter pattern means horizontal scaling is a matter of swapping the SQLite adapter for PostgreSQL (v2.3.0, see [ADR-001](decisions/ADR-001-sqlite-raw-sql-persistence.md)).

## Observability

Erledigen's observability roadmap ([ADR-004](decisions/ADR-004-structured-json-logging.md), [ADR-005](decisions/ADR-005-prometheus-metrics.md), [ADR-006](decisions/ADR-006-observability-stack.md)) is accepted but **not yet implemented**. Today:

1.  **Logs**: Plain console logging via `ConsoleLogger`.
2.  **Health**: A minimal `GET /api/health` returning `{ status: 'ok' }` (rich version with uptime/version/DB status is planned).
3.  **Metrics**: None yet -- a Prometheus-compatible `/api/metrics` endpoint is planned, with a Loki + Prometheus + Grafana stack (`docker-compose.monitoring.yml`) for self-hosted deployments.

## Dockerized

The app ships as containers: one multi-stage `Dockerfile` plus three compose files -- `compose.yaml` (dev: bind-mounted source, live `bun --watch`/vite HMR, dev DB in a named volume), `compose.prod.yaml` (prod: built artifacts behind a Caddy proxy on a single port), and `compose.test.yaml` (self-contained test stack with `STORAGE_ADAPTER=memory`). `mise run dev` / `prod` / `test-e2e` wrap them; see the root [README](../../../README.md) for details.
