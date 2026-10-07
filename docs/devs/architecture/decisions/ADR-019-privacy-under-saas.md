# ADR-019: Privacy Under SaaS: No Tracking, Anywhere

**Status**: Accepted
**Date**: 2026-10-07

## Context

The product principle to date: no analytics, no telemetry, no
tracking -- not even anonymized. Erledigen knows nothing about how you
use it except what you store in your own database. Running the app as
a hosted service puts that principle under pressure the way it never
was for self-hosting: SaaS operators conventionally add product
telemetry, funnels, session recording, error reporters, and "we
collect aggregated usage data" clauses.

## Decision

**No tracking, anywhere, in any deployment mode -- including the
hosted service.** Precisely:

1. **No product analytics or telemetry** in the client or server:
   no session/behavior tracking, no funnels, no heatmaps, no
   third-party analytics or error-reporting SDKs, ever.
2. **Operational logging exists and is not analytics.** Running a
   service requires structured logs with request IDs (ADR-004) and
   infrastructure metrics (ADR-005, already opt-out via
   `METRICS_ENABLED=false`). These measure the machine, not the
   person; they contain no user behavior and are not aggregated into
   user profiles.
3. **Billing is payment processing, not tracking.** If a hosted tier
   ever exists, the payment provider knows what the payment provider
   must know; the app tracks nothing about usage beyond what the
   feature itself stores in the user's own database.

The user-facing promise is unchanged by who runs the instance: "your
tasks are yours; the operator runs the software, not a surveillance
layer."

## Rationale

Privacy was never a self-hosting side effect -- it is the product's
stance. Keeping it identical across self-hosted and hosted turns the
SaaS into an *asset* ("we cannot see your tasks" -- the Standard
Notes / Bitwarden posture) instead of the usual SaaS privacy
regression. A single rule with no exceptions is also the only version
that stays enforceable: any "just this one metric" concession creates
the slippery slope the principle exists to prevent.

## Consequences

- No telemetry SDK may ever be added to any package (a future PR
  proposing one violates this ADR; superseding it requires a new ADR).
- Marketing/analytics requests are answered by infrastructure metrics
  and by asking users directly -- never by instrumenting them.
- The user docs state the promise plainly; the operator docs explain
  what operational logs contain (and that `METRICS_ENABLED=false`
  removes the metrics endpoint entirely).