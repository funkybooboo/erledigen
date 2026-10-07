# Upgrade

The boring path.

## Image tags

- **Release tags** (`0.10.1`, `0.11.0`, ...): published to GHCR on
  every release -- pin them to run a known version.
- **`latest`**: floats with releases -- track it if you always want
  the current release.

## Docker compose

1. **Back up first** -- at minimum the JSON snapshot
   ([backup and restore](./backup-restore.md)).
2. Pin or float the version: set the tag in `compose.prod.yaml`
   (default `latest`), then:

       docker compose -f compose.prod.yaml pull
       docker compose -f compose.prod.yaml up -d

3. Watch the logs until startup completes
   (`docker compose -f compose.prod.yaml logs -f server`) --
   migrations run at boot and fail fast if anything is wrong.
4. Verify: `curl http://localhost:8080/api/health` shows the new
   version.

## Kubernetes

    helm upgrade erledigen ./deploy/helm/erledigen --set image.tag=<new>

The server Deployment uses `Recreate`: the old pod fully stops before
the new one claims the volume -- no rolling race on the database.

Notes for both:

- Database migrations apply automatically on boot; there is no
  manual migration step.
- Downgrades are unsupported -- restore the backup instead.
- SIGTERM drains in-flight requests and closes WebSockets before the
  process exits (the server gets ~10s; k8s grace period 20s by
  default), so a rollout never drops a request mid-write.