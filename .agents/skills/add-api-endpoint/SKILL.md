---
name: add-api-endpoint
description: Add or change an Erledigen server API endpoint end to end -- shared types and route constants, Zod+OpenAPI schema, thin route handlers with error wrapping and content negotiation, service and repository layers (in-memory AND SQLite + contract tests), EventBus/WS broadcast, and api/Bruno tests. Use whenever touching server routes, services, or the data layer.
---

# Add an API Endpoint

The full vertical slice in dependency order. `packages/server/src/routes/taskRoutes.ts`
is the canonical example; follow its shape exactly.

## 1. Shared contract (packages/shared/src/)

- Types in `types/<entity>.ts` (e.g. `CreateTaskInput`, `Task`); new event
  payload shapes in `types/websocket.ts`.
- Route path constant in `constants.ts` under `API_ROUTES`.
- Re-export from `index.ts` (types via `export type`). Both sides import from
  `@erledigen/shared` only; never redeclare a shared concept in server or
  client.

## 2. Schema (packages/server/src/openapi/schemas/)

One Zod schema per entity doubles as the OpenAPI entry
(`@asteasolutions/zod-to-openapi`, registered via `openapi/registry.ts` and
`openapi/spec.ts`, served at `/openapi.json` and `/openapi.yaml`). The same
schema validates request bodies and queries.

## 3. Data layer (packages/server/src/adapters/data/)

- Interface `<Entity>Repository.ts`, then BOTH implementations:
  `InMemory<Entity>Repository` and `Sqlite<Entity>Repository` (raw SQL via
  `bun:sqlite`, no ORM).
- Schema changes need a forward-only migration
  `migrations/NNN_name.sql`; the runner tracks applied files in `_migrations`.
  `bun build` does not bundle `.sql`; the server build script copies
  `migrations/` into `dist/`, so an untracked migration file breaks builds.
- Contract tests in `contracts/<entity>RepositoryContract.ts` run against BOTH
  repositories (the InMemory and Sqlite test files are thin wrappers). Any
  repository behavior change updates the contract suite.
- IDs are stringified incrementing integers; Sqlite uses
  `MAX(CAST(id AS INTEGER))+1` to match in-memory semantics.

## 4. Service (packages/server/src/services/)

Business rules live in `<Entity>Service.ts`; routes stay thin. Wire services
and repos in `container.ts` as lazy getters. Throw shared `AppError` subclasses
(`NotFoundError`, `ValidationError`, `ConflictError`, ...), never strings or
plain `Error`.

## 5. Routes (packages/server/src/routes/<entity>Routes.ts)

A `register<Entity>Routes(...)` function called from `routes/index.ts`. Every
handler is wrapped; the shape is fixed:

    server.route('POST', API_ROUTES.TASKS,
        withErrorHandling(async req => {
            const input = parseBody(CreateTaskSchema, await req.json<unknown>());
            const originClientId = req.headers['x-client-id'];
            const task = await taskRepo.create(input);
            eventBus.publish('task:created', { task }, originClientId);
            return successResponse(task, 201);
        }, logger));

- `withErrorHandling` maps thrown AppErrors to HTTP responses; no manual
  try/catch in handlers.
- `parseBody`/`parseQuery` validate via the Zod schemas; `requirePathParam`
  for `:id`; `respondNegotiated` for content negotiation (text formatters in
  `src/presentation/formatters.ts`).
- Route order trap: literal sub-paths (`/purge`, `/generate-all`) must be
  registered BEFORE `:id` routes, or the literal is parsed as an id.
- WebSocket: publish the domain event on the EventBus, passing the request's
  `x-client-id` so the originator is skipped in the broadcast. Message shapes
  come from the shared `WsServerMessage` union.

## 6. Client wiring (if user-visible)

Follow the `build-client-feature` skill: service wrapper in
`packages/client/src/lib/services/`, store ingest in the matching
`*.svelte.ts` store.

## 7. Tests

- `tests/api-tests/<entity>.spec.ts`: black-box HTTP via the Playwright `api`
  project. Cover happy path, validation errors, 404s, content negotiation;
  clean up created entities in `afterEach` (one serial shared server).
- Bruno: add `.bru` requests in `tests/api/` when the collection already
  covers that resource.
- Unit tests for service/repo/migration logic sit next to the source.

## 8. Verify

Run the `verify-changes` gates (levels 1-4 at minimum). If behavior changed,
update the matching docs under `docs/` in the same commit.