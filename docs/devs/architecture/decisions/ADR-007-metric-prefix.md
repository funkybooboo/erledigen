# ADR-007: Metric Naming Prefix `erledigen_`

**Status**: Accepted  
**Date**: 2026-09-05  
**Supersedes**: the metric naming convention in [ADR-005](ADR-005-prometheus-metrics.md) (adapter design, endpoint, and catalog unchanged)

## Context

ADR-005 defines the `MetricsAdapter`, the `/api/metrics` endpoint, and the
metric catalog, but every metric name in its text carries an `alle_` prefix --
a prefix that does not match the project name and appears nowhere in the
codebase. No metrics code existed when ADR-005 was accepted, so the stale
prefix was never enforced anywhere; it would only surface at implementation
time.

ADRs are immutable once accepted, so the corrected naming decision is recorded
here rather than by editing ADR-005.

## Decision

All Erledigen metrics use the `erledigen_` prefix.

Everything else in ADR-005 stands unchanged: the metric catalog
(`http_requests_total`, `http_request_duration_seconds`, `jobs_total`, ...),
label sets, histogram buckets, the adapter interface, and the endpoint
behavior. Only the prefix differs from ADR-005's illustrative names.

## Rationale

- The prefix is the namespace that prevents collisions in a shared Prometheus
  instance; it should identify the project by its actual name.
- Consistency with the roadmap, which specifies `erledigen_http_requests_total`
  et al. throughout.
- Choosing now avoids a breaking rename of published metric names later.

## Consequences

### Positive

- Metric names match the project and the roadmap; `grep -r 'alle_'` over the
  codebase stays empty.

### Negative

- ADR-005's text still shows `alle_` in its examples; readers must cross-check
  this ADR for the real names. The metric-name constants in
  `packages/shared/src/adapters/metrics/metricNames.ts` are the single source
  of truth.

### Mitigations

- Names are defined once as shared constants and imported everywhere; nobody
  hand-writes metric name strings.