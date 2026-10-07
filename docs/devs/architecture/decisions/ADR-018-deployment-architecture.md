# ADR-018: Deployment Architecture: Self-Hostable, K8s-Ready, SaaS-Later

**Status**: Accepted
**Date**: 2026-10-07

## Context

Erledigen must run in three places: a developer's laptop, a homelab
(including a Kubernetes cluster), and the cloud -- and one day its
operator may run it as a hosted service for many users. Today's
operator story is real but thin: compose works, but nothing is
published (operators must build images from source), there are no
Kubernetes assets, the server has no graceful shutdown, and one health
endpoint serves both liveness and readiness.

The architecture has an honest constraint: SQLite on a volume,
WebSocket connections held in-process, and the job queue inside the
application database. That is a **single-replica** deployment. Scaling
horizontally requires PostgreSQL, a shared event bus for WebSocket
fanout, and authentication-scoped data -- the v2.x arc (ADR-001's
PostgreSQL clause, planned v2.3.0).

## Decision

1. **Published container images are the substrate.** CI builds and
   pushes the production images (server, client) to GHCR on every
   release. Operators install from images; building from source
   becomes optional, not required.
2. **Compose stays the canonical operator path** for VMs, cloud hosts,
   and any box with docker -- unchanged from today, now consuming
   published images.
3. **A Helm chart (in-repo) is the Kubernetes path**: server Deployment
   + PVC, client Deployment, Ingress, liveness/readiness probes,
   honest single-replica documentation. Plain manifests without Helm
   are reading material; Helm is the install idiom.
4. **Operational gaps close**: graceful shutdown on SIGTERM (drain
   in-flight requests, close WebSockets, exit clean) and distinct
   liveness (`/healthz` -- process alive) and readiness
   (`/readyz` -- dependencies reachable) endpoints, alongside the
   existing rich `/api/health`.
5. **SaaS-grade horizontal scale is explicitly deferred** to the v2.x
   arc. Nothing here pre-lands PostgreSQL, a shared event bus, or
   auth; the adapter seams (repositories, EventBus, JobQueue) already
   exist for that jump.

## Rationale

Images unify every target -- laptop, homelab, cloud -- and turn
"install" from a build into a pull. Helm is the distribution format
Kubernetes operators expect. Graceful shutdown and split probes are
prerequisites for any orchestrated deployment (rollouts otherwise
serve errors mid-deploy). Deferring the multi-tenant architecture keeps
the product queue moving; pulling it forward now would stall the app
for months without first proving the hosted demand.

## Consequences

- A release publishes images (GHCR) in addition to the git tag and
  GitHub Release.
- `docs/host/` documents compose-first, k8s-second, with the
  single-replica constraint stated, and carries the upgrade + backup
  runbooks.
- The Helm chart is maintained in-repo alongside the app it deploys.
- Migrations at boot remain the upgrade mechanism; upgrade and backup
  procedures must be documented, not invented (pre-restore backup and
  `nuke-db` already exist as primitives).