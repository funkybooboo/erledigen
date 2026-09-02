#!/usr/bin/env bash
# Update dependencies the way this monorepo requires.
#
# Why this exists -- bun traps learned the hard way (see PR #3):
#   * in workspaces, `bun update` only refreshes the package.json of the
#     dir it runs in -- so an update must run at the root AND in every
#     packages/* workspace
#   * `bun update` NEVER moves already-satisfied transitive pins -- pulling
#     in-range security fixes for transitives requires a full re-resolve
#     (--fresh), not an update
#   * `bun update <pkg>` for a non-direct dep silently ADDS it as a root
#     dependency at its latest major -- this script never does that
#   * a fresh re-resolve re-evaluates the audit-floor "overrides" block in
#     package.json; an uncapped ">=X" floor resolves to the LATEST release
#     (that is how cookie@2 once got pulled in and broke the build) -- keep
#     override floors exact-pinned
#
# Usage:
#   tools/update-deps.sh             in-place update (direct deps, in-range)
#   tools/update-deps.sh --fresh     full re-resolve: rm bun.lock + install
#                                    (also moves transitives; asks first)
#   tools/update-deps.sh --yes       do not ask for confirmation
#   tools/update-deps.sh --no-gates  skip the post-update verification gates
#   tools/update-deps.sh -n          dry run: checks and plan only

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

FRESH=0
ASSUME_YES=0
NO_GATES=0
DRY_RUN=0
for arg in "$@"; do
    case "$arg" in
        --fresh) FRESH=1 ;;
        --yes | -y) ASSUME_YES=1 ;;
        --no-gates) NO_GATES=1 ;;
        -n | --dry-run) DRY_RUN=1 ;;
        -h | --help)
            sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) die "unknown argument: $arg (see --help)" ;;
    esac
done

WORKSPACES=("." "packages/shared" "packages/server" "packages/client")
DEPS_FILES=(
    "package.json"
    "packages/shared/package.json"
    "packages/server/package.json"
    "packages/client/package.json"
    "bun.lock"
)

# -- preflight: state you should know about before touching deps -----------

step "Current audit status"
AUDIT_RC=0
AUDIT_OUT="$(bun audit 2>&1)" || AUDIT_RC=$?
if [ "$AUDIT_RC" -eq 0 ]; then
    note "no known vulnerabilities"
else
    printf '%s\n' "$AUDIT_OUT" | head -25
    note "vulnerabilities above (this update may or may not fix them)"
fi

step "Audit-floor overrides in package.json (watch for uncapped >= floors)"
OVERRIDES="$(bun -e '
const pkg = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
for (const [name, range] of Object.entries(pkg.overrides || {})) {
    const kind = range.startsWith(">=") ? "UNCAPPED" : /^[0-9]/.test(range) ? "pinned  " : "capped  ";
    console.log(`${kind} ${name} ${range}`);
}
' "$REPO_ROOT/package.json")"
if [ -n "$OVERRIDES" ]; then
    while IFS= read -r line; do note "$line"; done <<<"$OVERRIDES"
    if [ "$FRESH" = 1 ]; then
        note "WARNING: --fresh re-resolves every floor; UNCAPPED ones move to the"
        note "latest release (the cookie@2 breakage came from exactly this)"
    fi
else
    note "no overrides block"
fi

step "Working tree state"
DIRTY="$(git -C "$REPO_ROOT" status --porcelain || true)"
if [ -n "$DIRTY" ]; then
    note "WARNING: the tree is not clean -- the dep diff will mix with:"
    printf '%s\n' "$DIRTY" | head -10 | sed 's/^/        /'
else
    note "clean"
fi

if [ "$DRY_RUN" = 1 ]; then
    step "Dry run -- plan"
    if [ "$FRESH" = 1 ]; then
        note "rm bun.lock && bun install   (full re-resolve, moves transitives)"
    else
        for ws in "${WORKSPACES[@]}"; do
            note "(cd $ws && bun update)      (in-range direct deps only)"
        done
    fi
    [ "$NO_GATES" = 1 ] && note "gates: skipped (--no-gates)" || note "gates: frozen-lockfile parity, type-check, unit tests, tools/build.sh"
    note "No changes made."
    exit 0
fi

# -- confirmation for the risky path ------------------------------------------

if [ "$FRESH" = 1 ] && [ "$ASSUME_YES" != 1 ]; then
    if [ ! -t 0 ]; then
        die "--fresh discards and re-resolves bun.lock; re-run with --yes to confirm"
    fi
    printf '==> --fresh deletes bun.lock and re-resolves everything.\n'
    printf '    Uncapped override floors will move to their latest release.\n'
    printf '    Proceed? [y/N] '
    read -r answer
    case "$answer" in
        y | Y | yes) ;;
        *) die "aborted" ;;
    esac
fi

# -- backup --------------------------------------------------------------------

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="/tmp/erledigen-deps-backup-$STAMP"
step "Backing up manifests + lockfile to $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
for f in "${DEPS_FILES[@]}"; do
    cp "$REPO_ROOT/$f" "$BACKUP_DIR/$(echo "$f" | tr '/' '_')"
done
note "rollback: cp $BACKUP_DIR/* back over their files (see names above)"

# -- update --------------------------------------------------------------------

if [ "$FRESH" = 1 ]; then
    step "Fresh re-resolve (rm bun.lock + bun install)"
    rm "$REPO_ROOT/bun.lock"
    from_root bun install
else
    for ws in "${WORKSPACES[@]}"; do
        label="$ws"
        if [ "$ws" = "." ]; then label="root"; fi
        step "Updating $label"
        (cd "$REPO_ROOT/$ws" && bun update)
    done
fi

# -- gates ---------------------------------------------------------------------

if [ "$NO_GATES" = 1 ]; then
    step "Gates skipped (--no-gates)"
else
    step "Gate: lockfile/CI parity (frozen install)"
    from_root bun install --frozen-lockfile >/dev/null

    step "Gate: type-check"
    from_root bun run type-check

    step "Gate: unit tests"
    from_root bun run test:unit

    step "Gate: build + bundle budget (catches the cookie-class breakage)"
    "$TOOLS_DIR/build.sh"
fi

# -- summary -------------------------------------------------------------------

step "Result"
git -C "$REPO_ROOT" diff --stat -- "${DEPS_FILES[@]}"
step "Audit status after update"
AUDIT_RC=0
AUDIT_OUT="$(bun audit 2>&1)" || AUDIT_RC=$?
if [ "$AUDIT_RC" -eq 0 ]; then
    note "no known vulnerabilities"
else
    printf '%s\n' "$AUDIT_OUT" | head -25
    note "vulnerabilities remain -- review, or try --fresh for transitive fixes"
fi
step "Done. Review the diff, then commit manifests + bun.lock together."