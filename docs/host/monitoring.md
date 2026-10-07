# Monitoring

Health checks and metrics for your instance (the full hookup guide is
[HOST-8](../../plans/stories/HOST-8-monitoring-hookup.md); the
Grafana/Loki stack ships at v1.0.0 as
[HOST-9](../../plans/stories/HOST-9-monitoring-stack.md)).

## Health

- `GET /api/health` -- the rich check: status, version, uptime,
  database details, WebSocket connection count, job-queue depth.
  Use it for uptime monitors.
- `GET /healthz` -- liveness: the process is alive, deliberately no
  dependency checks (a database outage must not get the container
  restarted).
- `GET /readyz` -- readiness: dependencies reachable (a SQLite SELECT 1
  catches a detached or corrupted database file); answers 503 while
  not, which pauses traffic without restarting anything.
- The compose healthcheck uses `/api/health`; the Helm chart wires
  `/healthz` to liveness and `/readyz` to readiness.

## Metrics

- `GET /api/metrics` -- Prometheus text exposition: HTTP request
  counters/latency, job metrics, and application gauges (uptime,
  tasks, WebSocket connections, DB size). Metric names are
  `erledigen_`-prefixed (ADR-007).
- Scrape it like any Prometheus target; the compose stacks expose it
  only inside the network by default.
- `METRICS_ENABLED=false` removes the endpoint entirely (ADR-019:
  metrics measure the machine, not the person).