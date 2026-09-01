# @erledigen/server

The Bun REST API + WebSocket server for Erledigen. Runs on port 4000 and serves the full task management API.

Follows the adapter pattern: route handlers are thin HTTP adapters that delegate to a service layer, which in turn uses repository interfaces from `@erledigen/shared`. The same Zod schemas drive both OpenAPI generation and request validation — no duplication.

## Quick Start

```bash
mise run server   # dockerized dev container
# or locally: bun run --cwd packages/server dev
```

The server is available at `http://localhost:4000`. Storage is selected via
`STORAGE_ADAPTER` (`sqlite` by default — a single `.db` file at `DB_PATH`,
migrations run at boot; `memory` for ephemeral runs and tests).

## API Overview

| Resource | Endpoints |
|----------|-----------|
| Tasks | `GET/POST /api/tasks`, `GET/PUT/DELETE /api/tasks/:id`, `POST /api/tasks/:id/restore`, `GET /api/tasks/trash`, `POST /api/tasks/purge` |
| Projects | `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/:id`, `POST /api/projects/:id/activate`, `POST /api/projects/:id/deactivate` |
| Recurring Tasks | `GET/POST /api/recurring-tasks`, `GET/PUT/DELETE /api/recurring-tasks/:id`, `POST /api/recurring-tasks/:id/generate`, `POST /api/recurring-tasks/generate-all`, `GET /api/recurring-tasks/:id/stats` |
| Someday Groups | `GET/POST /api/someday-groups`, `GET/PUT/DELETE /api/someday-groups/:id` |
| Tags | `GET /api/tags`, `GET /api/tags/info`, `POST /api/tags/rename`, `POST /api/tags/merge` |
| Preferences | `GET /api/preferences`, `PATCH /api/preferences` |
| Meta | `GET /api/health`, `GET /openapi.yaml`, `GET /openapi.json` |

The full OpenAPI 3.1 spec is served at `http://localhost:4000/openapi.yaml` (or `/openapi.json`).

## Layout

```
src/
├── adapters/
│   ├── config/    # EnvConfigProvider (env-var-driven config)
│   ├── data/      # In-memory + SQLite repositories for every entity,
│   │              #   shared contract suites, migrations/, SqliteConnection
│   ├── http/      # HttpRequest / HttpResponse types, BunHttpServer
│   └── ws/        # BunWebSocketServer + ConnectionManager (broadcast + send)
├── middleware/    # Rate limiter, security headers
├── openapi/
│   └── schemas/   # Zod schemas — single source of truth for spec + validation
├── presentation/  # Content-negotiated formatters (JSON + plain text)
├── routes/        # Thin HTTP adapters per resource + openApiRoutes
├── services/      # Domain services (Task, Tag, RecurringTask, Project, WebSocketManager, EventBus)
└── utils/         # Error handling, route helpers, validation, recurring utils
```

## Scripts

| Script | What it does |
|--------|--------------|
| `bun run dev` | Watch mode (`bun --watch`) |
| `bun run start` | Run the server (`bun src/index.ts`; migrations run at boot) |
| `bun run build` | `bun build` to `./dist` (target bun) |
| `bun run type-check` | `tsc --noEmit` |
| `bun run test` | Unit tests via `bun test` |

## Learn More

See [Architecture](../../docs/devs/architecture/architecture.md) for how the server fits into the broader system.
