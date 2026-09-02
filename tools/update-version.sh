#!/usr/bin/env bash
# Bump the package version across the monorepo.
#
# All four package.json files (root + shared + server + client) must carry
# the same version, so this script updates them as one unit and refreshes
# bun.lock afterwards (it records workspace package versions).
#
# Usage:
#   tools/update-version.sh <major|minor|patch|X.Y.Z>
#
# Examples:
#   tools/update-version.sh patch        1.2.3 -> 1.2.4
#   tools/update-version.sh minor        1.2.3 -> 1.3.0
#   tools/update-version.sh major        1.2.3 -> 2.0.0
#   tools/update-version.sh 2.1.0        set the version explicitly

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

BUMP="${1:-}"
if [ -z "$BUMP" ]; then
    sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//' >&2
    exit 1
fi

MANIFESTS=(
    "package.json"
    "packages/shared/package.json"
    "packages/server/package.json"
    "packages/client/package.json"
)

# -- read the current version -----------------------------------------------

read_version() {
    grep -m1 '"version"' "$REPO_ROOT/$1" | sed 's/[^0-9.]*//g'
}

CURRENT="$(read_version "${MANIFESTS[0]}")"
if ! [[ "$CURRENT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    die "cannot parse current version from ${MANIFESTS[0]}: '$CURRENT'"
fi

# -- compute the new version -------------------------------------------------

if [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    NEW="$BUMP"
else
    IFS='.' read -r MAJOR MINOR PATCH <<<"$CURRENT"
    case "$BUMP" in
        major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
        minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
        patch) PATCH=$((PATCH + 1)) ;;
        *) die "invalid bump: '$BUMP' (expected major, minor, patch, or X.Y.Z)" ;;
    esac
    NEW="$MAJOR.$MINOR.$PATCH"
fi

# -- refuse surprising downgrades -------------------------------------------

if [[ "$NEW" == "$CURRENT" ]]; then
    die "new version $NEW is the same as the current version"
fi

# -- write the version to every manifest -------------------------------------

step "Updating version $CURRENT -> $NEW"

for manifest in "${MANIFESTS[@]}"; do
    file_version="$(read_version "$manifest")"
    if [ "$file_version" != "$CURRENT" ]; then
        note "WARNING: $manifest was $file_version (out of sync) -- forcing to $NEW"
    fi
done

# bun does the JSON edit so formatting stays exact (4-space indent,
# trailing newline) without sed quirks across platforms.
REPO_ROOT="$REPO_ROOT" NEW_VERSION="$NEW" \
    MANIFESTS="$(printf '%s\n' "${MANIFESTS[@]}")" bun -e '
const fs = require("fs");
for (const manifest of process.env.MANIFESTS.split("\n")) {    const path = process.env.REPO_ROOT + "/" + manifest;
    const pkg = JSON.parse(fs.readFileSync(path, "utf8"));
    pkg.version = process.env.NEW_VERSION;
    fs.writeFileSync(path, JSON.stringify(pkg, null, 4) + "\n");
}
' <<<"$(printf '%s\n' "${MANIFESTS[@]}")"

step "Refreshing bun.lock (it mirrors workspace package versions)"
from_root bun install >/dev/null 2>&1

# bun install does NOT rewrite the workspace "version" mirrors in bun.lock
# (verified: even --frozen-lockfile tolerates the drift), so sync them
# explicitly. The lockfile's only "version" JSON fields are the three
# workspace mirrors -- dependency versions live in "pkg@x.y.z" id strings.
stale_count="$(grep -c "\"version\": \"$CURRENT\"" "$REPO_ROOT/bun.lock" || true)"
if [ "${stale_count:-0}" -gt 0 ]; then
    sed -i.bak "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW\"/g" "$REPO_ROOT/bun.lock"
    rm -f "$REPO_ROOT/bun.lock.bak"
    note "bun.lock: $stale_count workspace version field(s) synced to $NEW"
fi

step "Done: version is now $NEW"
for manifest in "${MANIFESTS[@]}"; do
    note "$manifest -> $NEW"
done
note "bun.lock refreshed"
note "Commit the manifests + bun.lock (or use tools/release.sh, which does it for you)"
