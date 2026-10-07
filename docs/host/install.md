# Install

Run erledigen anywhere containers run. Published images live on GHCR;
your data is one SQLite file on a volume.

## Docker compose (the canonical path)

    docker compose -f compose.prod.yaml pull
    docker compose -f compose.prod.yaml up -d

- **server** -- Bun: the REST API, WebSocket sync, SQLite (migrations
  run at boot)
- **client** -- Node: the SvelteKit app
- **proxy** -- Caddy: one published port (default 8080) routing
  `/api/*` and `/ws` to the server, everything else to the client,
  TLS automatically when you give it a domain (see
  [deploy/Caddyfile](../../deploy/Caddyfile))

The `pull` first: the stack prefers the published images and falls
back to building from source (drop the `pull` and pass `--build` to
`up` if you want to build your own).

## Kubernetes

An in-repo Helm chart deploys the same images
([HOST-2](../../plans/stories/HOST-2-run-on-kubernetes.md)):

    helm install erledigen ./deploy/helm/erledigen \
      --set ingress.host=erledigen.example.com

- The chart deploys server (PVC + probes) and client behind one
  Ingress: `/api` and `/ws` to the server, `/` to the client -- the
  same split the compose proxy does. TLS follows your ingress
  controller; no Caddy container in-cluster.
- **Single replica, on purpose**: the SQLite file, the WebSocket
  connections, and the job queue all live in the one server pod
  (ADR-018). The Deployment uses `Recreate` so rollouts never race on
  the volume.
- Probes: `/healthz` (liveness -- the process) and `/readyz`
  (readiness -- the database).
- Values: image tag, storage class + size, ingress host, the config
  knobs -- see
  [deploy/helm/erledigen/values.yaml](../../deploy/helm/erledigen/values.yaml).

## First run and daily operations

- Data persists in the `prod-data` volume (compose) or the PVC
  `erledigen-data` (k8s). `docker compose -f compose.prod.yaml down`
  keeps it.
- Check the instance: `curl http://localhost:8080/api/health`
- Permanently delete the database volume (stops the stack first):
  `mise run nuke-db -- prod` -- it asks you to type the stack name.
- Upgrades: see [upgrade](./upgrade.md). Backups:
  [backup and restore](./backup-restore.md).
- Configuration: see the
  [configuration reference](./configuration.md).

## On a real domain (compose)

Replace `:8080` in the Caddyfile with your domain and publish ports
80/443 instead of `PROD_PORT` -- Caddy provisions Let's Encrypt
certificates and redirects HTTP to HTTPS automatically. Details in
the [Caddyfile header](../../deploy/Caddyfile).