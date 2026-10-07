# Host Documentation

For operators: anyone running an instance of erledigen -- on a VM, in
a homelab, on Kubernetes, or as the hosted service.

- [Install](./install.md) -- the compose stack (and the Kubernetes
  chart, [HOST-2](../../plans/stories/HOST-2-run-on-kubernetes.md))
- [Configuration](./configuration.md) -- every environment variable
  in one table ([HOST-7](../../plans/stories/HOST-7-configuration-reference.md))
- [Upgrade](./upgrade.md) -- the boring path
  ([HOST-5](../../plans/stories/HOST-5-upgrade-runbook.md))
- [Backup and restore](./backup-restore.md)
  ([HOST-6](../../plans/stories/HOST-6-backup-restore-runbook.md))
- [Monitoring](./monitoring.md) -- health checks + Prometheus
  ([HOST-8](../../plans/stories/HOST-8-monitoring-hookup.md))

## How erledigen runs (the honest shape)

One server container (Bun: REST + WebSocket + SQLite), one client
container (Node: SvelteKit), and your reverse proxy. The database is
a single SQLite file on a volume; migrations apply at boot.

**Single replica, on purpose.** SQLite on a volume, WebSocket
connections held in-process, and the job queue inside the app mean
this is a one-replica deployment (ADR-018) -- scale the machine, not
the replica count. Multi-replica (PostgreSQL, shared event bus)
arrives with the hosted-services arc
([HOST-10](../../plans/stories/HOST-10-postgresql-scale.md)).

## The privacy shape

No tracking, anywhere (ADR-019): the app collects no analytics and no
telemetry. Operational logs and Prometheus metrics exist to run the
machine; `METRICS_ENABLED=false` removes the metrics endpoint
entirely.