# HOST-2: Run erledigen on Kubernetes

As an operator running a Kubernetes cluster, I want a Helm chart, so
that installing erledigen is one standard `helm install` instead of
hand-built manifests.

**Status**: done
**Version**: v0.10.1

## Acceptance criteria
- [x] In-repo Helm chart: server Deployment + PVC, client Deployment,
      Ingress, probes, resource hints
- [x] Values cover image tags, the storage class, the public origin,
      and the config knobs
- [x] The chart documents the single-replica constraint honestly
      (SQLite on a PVC, WebSocket in-process, jobs in-app -- scale
      out is the v2.x architecture, not a values tweak)
- [x] An operator-facing install walkthrough lives in docs/host/

## Notes

ADR-018. TLS terminates at the cluster's ingress controller; the
Caddy proxy stays a compose-only concern.
