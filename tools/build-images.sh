#!/usr/bin/env bash
# Build the docker images for a stack WITHOUT starting anything.
#
# tools/build.sh builds the app packages locally (bun + vite, outputs under
# packages/*/dist and packages/client/build). This script is the other half:
# it builds the container images from the multi-stage Dockerfile via the
# compose files. Useful to pre-warm the image cache (a cold test-stack build
# takes 10+ minutes) or to verify a Dockerfile change without booting a stack.
#
# Usage:
#   tools/build-images.sh dev    dev images (erledigen/dev) -- compose.yaml
#   tools/build-images.sh test   test images (erledigen/dev + erledigen/e2e) -- compose.test.yaml
#   tools/build-images.sh prod   prod images (erledigen/server + erledigen/client) -- compose.prod.yaml
#   tools/build-images.sh all    all of the above
#
# NOTE: image tags are hardcoded in the compose files (erledigen/dev,
# erledigen/e2e, ...) and shared by every checkout. If another session's
# stack is running off those tags, build from a worktree only with a retag
# override (see tests/README.md, "Notes").

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

MODE="${1:-}"
if [ -z "$MODE" ]; then
    sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//' >&2
    exit 1
fi
if [ "$MODE" = "-h" ] || [ "$MODE" = "--help" ]; then
    sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
fi

build_dev() {
    step "Building dev images (erledigen/dev) via compose.yaml"
    docker compose -f "$REPO_ROOT/compose.yaml" build
}

build_test() {
    step "Building test images (erledigen/dev + erledigen/e2e) via compose.test.yaml"
    docker compose -f "$REPO_ROOT/compose.test.yaml" build
}

build_prod() {
    step "Building prod images (erledigen/server + erledigen/client) via compose.prod.yaml"
    docker compose -f "$REPO_ROOT/compose.prod.yaml" build
}

case "$MODE" in
    dev) build_dev ;;
    test) build_test ;;
    prod) build_prod ;;
    all)
        build_dev
        build_test
        build_prod
        ;;
    *) die "unknown stack: '$MODE' (expected dev, test, prod, or all)" ;;
esac

step "Images built"