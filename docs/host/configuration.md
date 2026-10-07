# Configuration

Every knob an operator can turn. Configuration is environment
variables (12-factor); containers take them from the compose files,
Kubernetes from the Helm chart's values.

## Server

| Variable | Default | What it does |
|----------|---------|--------------|
| `PORT` | `4000` | HTTP + WebSocket port |
| `CORS_ORIGIN` | `*` | Allowed origins (same-origin via the proxy by default) |
| `NODE_ENV` | `production` | Environment flag (logging defaults) |
| `STORAGE_ADAPTER` | `sqlite` | `memory` for ephemeral runs (data does not survive restarts) |
| `DB_PATH` | `/data/erledigen.db` in containers | SQLite file -- keep it on the volume |
| `RATE_LIMIT_RPM` | `600` | Requests per minute per client |
| `LOG_FORMAT` | `json` in prod | `json` for log collectors (ADR-004), `text` for humans |
| `LOG_LEVEL` | `info` in prod | Minimum log level |
| `METRICS_ENABLED` | `true` | `false` removes `/api/metrics` entirely (ADR-005, ADR-019) |
| `APP_VERSION` | the release stamp | Version reported by `/api/health` |
| `JOB_POLL_INTERVAL_MS` | `1000` | Job runner poll interval (ADR-002) |
| `JOB_MAX_ATTEMPTS` | `3` | Attempts before a job is marked dead |
| `JOB_RETRY_BASE_DELAY_MS` | `5000` | Backoff base: the Nth failure retries after 2^N x this |
| `JOB_TIMEOUT_MS` | `30000` | Per-attempt job handler timeout |

## Client

| Variable | Default | What it does |
|----------|---------|--------------|
| `VITE_API_URL` (build-time) | empty = same-origin | Absolute URL only for split-origin deployments |
| `VITE_PORT` | `3000` | Dev server port |

## Compose-level

| Variable | Default | What it does |
|----------|---------|--------------|
| `PROD_PORT` | `8080` | The single published port (the proxy) |

## Rules of thumb

- Same-origin (the default) needs no CORS and no WebSocket origin
  configuration -- the proxy routes everything.
- Never move `DB_PATH` off the volume; that file is all your data.
- Every value the Helm chart exposes mirrors this table
  ([deploy/helm/erledigen/values.yaml](../../deploy/helm/erledigen/values.yaml)).