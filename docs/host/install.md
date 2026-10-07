# Install

Run erledigen with docker compose (or podman). One published port,
your data in a named volume.

## The stack

    docker compose -f compose.prod.yaml up -d --build

- **server** -- Bun: the REST API, WebSocket sync, SQLite (migrations
  run at boot)
- **client** -- Node: the SvelteKit app
- **proxy** -- Caddy: one published port (default 8080) routing
  `/api/*` and `/ws` to the server, everything else to the client,
  TLS automatically when you give it a domain (see
  [deploy/Caddyfile](../../deploy/Caddyfile))

Published images on GHCR and the Kubernetes Helm chart are the
v0.10.1 platform stories
([HOST-1](../../plans/stories/HOST-1-install-from-images.md),
[HOST-2](../../plans/stories/HOST-2-run-on-kubernetes.md)); until
they land, the stack builds from source on first start.

## First run and daily operations

- Data persists in the `prod-data` named volume. `docker compose -f
  compose.prod.yaml down` keeps it.
- Check the instance: `curl http://localhost:8080/api/health`
- Permanently delete the database volume (stops the stack first):
  `mise run nuke-db -- prod` -- it asks you to type the stack name.
- Upgrades: see [upgrade](./upgrade.md). Backups:
  [backup and restore](./backup-restore.md).
- Configuration: every environment variable lives in the
  [configuration reference](./configuration.md).

## On a real domain

Replace `:8080` in the Caddyfile with your domain and publish ports
80/443 instead of `PROD_PORT` -- Caddy provisions Let's Encrypt
certificates and redirects HTTP to HTTPS automatically. Details in
the [Caddyfile header](../../deploy/Caddyfile).