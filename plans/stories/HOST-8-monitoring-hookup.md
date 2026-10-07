# HOST-8: Hook erledigen into my monitoring

As an operator, I want documented monitoring integration, so that my
instance is observable with the tools I already run.

**Status**: done
**Version**: v0.10.1

## Acceptance criteria
- [x] docs/host/ documents the Prometheus scrape config for
      /api/metrics (the metric families it exposes)
- [x] Health-check guidance for uptime monitors (/healthz)
- [x] METRICS_ENABLED=false documented as the off switch
- [x] The full Loki/Grafana stack stays a v1.0-era story (HOST-9)

## Notes

ADR-018, ADR-005, ADR-007. Metrics already exist and are opt-out;
this is the operator-facing hookup.
