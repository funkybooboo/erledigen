# HOST-4: Distinct liveness and readiness endpoints

As an operator on an orchestrator, I want separate liveness and
readiness probes, so that restarts happen only when the process is
broken and traffic pauses only while dependencies are unreachable.

**Status**: done
**Version**: v0.10.1

## Acceptance criteria
- [x] `/healthz` answers "the process is alive" (cheap, no dependency
      checks)
- [x] `/readyz` answers "dependencies reachable" (DB check included)
- [x] The rich human-oriented `/api/health` stays untouched
- [x] Helm chart and compose healthchecks use the right probe each

## Notes

ADR-018. Splits today's fused `/api/health` job into k8s-shaped
probes.
