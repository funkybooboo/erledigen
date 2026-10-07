# Backup and restore

Two layers, use both (the full runbook is
[HOST-6](../../plans/stories/HOST-6-backup-restore-runbook.md)).

## Layer 1: the app-level JSON snapshot

Export from Settings -> Export (JSON). It is the complete, restorable
record of everything -- tasks including the trash, someday groups,
projects, habits, holidays, day notes, and your settings (ADR-008).
Restoring is **replace, not merge**: the snapshot becomes the
instance's entire data set, and the server writes a safety backup
next to the database before wiping anything (ADR-009) -- so even a
mistaken restore is itself restorable.

## Layer 2: the database volume

The SQLite file lives in the `prod-data` named volume. Back it up at
the host level (volume snapshots, `docker run --rm -v erledigen-prod_prod-data:/data -v $(pwd):/backup alpine tar czf /backup/erledigen-data.tar.gz /data`).
Do this while the stack is stopped or accept the tiny window --
SQLite WAL mode keeps a clean file on disk.

## Restoring

- **From a JSON snapshot**: fresh instance -> Settings -> Import ->
  Erledigen backup (JSON) -> confirm. The pre-restore safety backup
  is written first.
- **From a volume backup**: stop the stack, restore the volume
  contents, start. The server runs its migrations at boot if the
  backup predates a version bump.
- The export snapshot is versioned (ADR-008); old snapshots keep
  restoring as the schema evolves.