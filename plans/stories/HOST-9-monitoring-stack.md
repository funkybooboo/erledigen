# HOST-9: The monitoring stack ships

As an operator, I want the shipped Prometheus + Grafana + Loki stack
(ADR-006), so that my instance's metrics, logs, and health are one
dashboard.

**Status**: planned
**Version**: v1.0.0

## Acceptance criteria
- [ ] Compose profile / stack with Prometheus, Grafana, Loki,
      Uptime Kuma wired to the app's existing endpoints
- [ ] Dashboards importable; the metric names follow ADR-007

## Notes

The observability core (logs, metrics, health) shipped in v0.8.0
(history.md); this is the stack around it.