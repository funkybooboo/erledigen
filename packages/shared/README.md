# @erledigen/shared

Shared code used by both the `client` and `server` packages. Nothing in here should be environment-specific — it must run in both Bun and the browser.

## Contents

| Path | What's in it |
|------|-------------|
| `src/types/` | Core data models: `Task`, `Project`, `RecurringTask`, `SomeDayGroup`, `UserPreferences`, `ApiResponse`, plus API/WebSocket request types |
| `src/adapters/` | Adapter interfaces (ports) and universal implementations: `HttpClient`, `Logger`, `DateProvider`, `ConfigProvider`, `ExportAdapter`, `ImportAdapter` |
| `src/errors/` | `AppError` base class and typed error subclasses (`ValidationError`, `NotFoundError`, `RateLimitError`, etc.) |
| `src/utils/` | Pure helpers: `slugify`, `groupTasksByDate`, `isOverdue`, `resolveTagKind`, `formatFrequency`, date/time validation |
| `src/constants.ts` | API route patterns, validation rules, default tag kinds, retention/limits |

## The Golden Rule

If the client needs it **and** the server needs it → put it here.  
If only the server needs it → `packages/server`.  
If only the client needs it → `packages/client`.

## Learn More

See [Architecture](../../docs/devs/architecture/architecture.md) for how the shared package fits into the broader system.
