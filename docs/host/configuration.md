# Configuration

Every knob an operator can turn. All configuration is environment
variables (12-factor); containers take them from the compose files,
Kubernetes from the chart's values.

> This page is the start of the one-table configuration reference
> ([HOST-7](../../plans/stories/HOST-7-configuration-reference.md));
> the full table is being filled in there. Until then, the
> complete live list with defaults and explanations lives in the
> [getting-started guide](../build/process/getting-started.md).

## The ones you will actually touch

| Variable | Container | Default | What it does |
|----------|-----------|---------|--------------|
| `PROD_PORT` | proxy | `8080` | The single published port |
| `DB_PATH` | server | `/data/erledigen.db` | SQLite file (keep it on the volume) |
| `CORS_ORIGIN` | server | `*` | Allowed origins (same-origin via the proxy by default) |
| `RATE_LIMIT_RPM` | server | `600` | Requests per minute per client |
| `METRICS_ENABLED` | server | `true` | `false` removes the metrics endpoint entirely (ADR-005, ADR-019) |
| `STORAGE_ADAPTER` | server | `sqlite` | `memory` for ephemeral runs (tests, throwaways -- data does not survive restarts) |
| `VITE_API_URL` | client (build) | empty = same-origin | Absolute URL only for split-origin deployments |

## Rules of thumb

- Same-origin (the default) needs no CORS and no WebSocket origin
  configuration -- the proxy routes everything.
- Never move `DB_PATH` off the volume; that file is all your data.
- `LOG_FORMAT=json` and `LOG_LEVEL=info` are the production defaults;
  see the [logging ADR-004](../build/architecture/decisions/ADR-004-structured-json-logging.md).