#!/usr/bin/env bash
# PERMANENTLY delete the dev or prod database -- every task, habit, and
# preference in that stack. Both DBs are SQLite files inside named docker
# volumes, so "blowing up the database" means removing the whole volume
# (DB file + WAL/SHM sidecars + anything else that ever landed in /data):
#
#   dev  -> erledigen_dev-data        (compose.yaml)
#   prod -> erledigen-prod_prod-data  (compose.prod.yaml)
#
# Usage:
#   tools/nuke-db.sh dev            stop the dev stack, delete its DB volume
#   tools/nuke-db.sh prod           stop the prod stack, delete its DB volume
#   tools/nuke-db.sh --yes dev      skip the confirmation prompt
#
# After a nuke, the next `mise run dev` / `mise run prod` recreates the
# volume and the server's boot migrations create a fresh, empty schema.
#
# Notes:
# - Asks you to type the stack name before destroying anything.
# - The prod stack's caddy-data/caddy-config volumes (TLS certificates) are
#   never touched -- only the DB volume is removed, never `compose down -v`.
# - The test stack has no database to nuke (STORAGE_ADAPTER=memory).
# - Works from any checkout/worktree: compose project names are fixed in the
#   compose files, so there is exactly one dev volume and one prod volume.

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# -- args ----------------------------------------------------------------------

ASSUME_YES=0
STACK=""

for arg in "$@"; do
    case "$arg" in
    -h | --help)
        sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'
        exit 0
        ;;
    -y | --yes) ASSUME_YES=1 ;;
    dev | prod) STACK="$arg" ;;
    test)
        die "the test stack has no database to nuke (STORAGE_ADAPTER=memory, no volumes)"
        ;;
    *)
        die "unknown argument: '$arg' (expected dev or prod)"
        ;;
    esac
done

if [ -z "$STACK" ]; then
    sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//' >&2
    exit 1
fi

# -- stack-specific config -----------------------------------------------------

case "$STACK" in
dev)
    COMPOSE_FILE="$REPO_ROOT/compose.yaml"
    VOLUME="erledigen_dev-data"
    RESTART_HINT="mise run dev"
    ;;
prod)
    COMPOSE_FILE="$REPO_ROOT/compose.prod.yaml"
    VOLUME="erledigen-prod_prod-data"
    RESTART_HINT="mise run prod"
    ;;
esac

# -- sanity checks -------------------------------------------------------------

docker info >/dev/null 2>&1 || die "docker is not running"

if ! docker volume inspect "$VOLUME" >/dev/null 2>&1; then
    step "No ${STACK} database to nuke"
    note "volume '${VOLUME}' does not exist -- the stack was never started, or the DB was already nuked"
    exit 0
fi

# -- confirmation --------------------------------------------------------------

step "About to PERMANENTLY DELETE the ${STACK} database"
note "stops  : the whole ${STACK} stack (docker compose -f ${COMPOSE_FILE##*/} down)"
note "deletes: volume '${VOLUME}' -- everything in it, no backup, no undo"
if [ "$STACK" = prod ]; then
    note "WARNING : this is the PROD database; all live data will be gone"
fi

if [ "$ASSUME_YES" != 1 ]; then
    reply=""
    printf 'Type "%s" to delete: ' "$STACK" >&2
    if ! { read -r reply < /dev/tty; } 2>/dev/null; then
        die "no terminal available for confirmation; re-run with --yes"
    fi
    [ "$reply" = "$STACK" ] || die "aborted (typed '${reply:-nothing}')"
fi

# -- nuke ----------------------------------------------------------------------

step "Stopping the ${STACK} stack"
docker compose -f "$COMPOSE_FILE" down

step "Deleting the ${STACK} database volume (${VOLUME})"
if ! docker volume rm "$VOLUME"; then
    die "could not remove volume '${VOLUME}' -- still in use by a container outside the compose project? (docker ps -a --filter volume=${VOLUME})"
fi

step "${STACK} database nuked"
note "a fresh, empty schema is created by the boot migrations on the next start"
note "restart the stack: ${RESTART_HINT}"