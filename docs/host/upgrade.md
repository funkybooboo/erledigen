# Upgrade

The boring path (the full runbook is
[HOST-5](../../plans/stories/HOST-5-upgrade-runbook.md)).

1. **Back up first** -- at minimum the JSON snapshot
   ([backup and restore](./backup-restore.md)).
2. Pull the new release and rebuild:

       docker compose -f compose.prod.yaml up -d --build

3. Watch the logs until startup completes
   (`docker compose -f compose.prod.yaml logs -f server`) -- migrations
   run at boot and fail fast if anything is wrong.
4. Verify: `curl http://localhost:8080/api/health` shows the new
   version.

Notes:

- Database migrations apply automatically on boot; there is no manual
  migration step.
- Downgrades are unsupported -- restore the backup instead.
- Image tag policy (release tags vs floating) lands with
  [HOST-1](../../plans/stories/HOST-1-install-from-images.md).