#!/usr/bin/env bash
# Orchestrate the dockerized test stack (compose.test.yaml).
#
# One entry point for every test flavor so the build/up/run/down dance --
# including tearing the stack down when a test run fails -- lives in exactly
# one place. `mise run test*` all delegate here.
#
# Usage:
#   tools/test-stack.sh unit   unit tests (compose service: unit)
#   tools/test-stack.sh api    Bruno API tests against server-test
#   tools/test-stack.sh e2e    Playwright e2e + api tests (server-test + client-test)
#   tools/test-stack.sh all    api then e2e in one stack
#
# NOTE: compose.test.yaml tags images erledigen/dev and erledigen/e2e
# regardless of which checkout built them. If you run this from a worktree
# while another stack is up, retag the images via a compose override first
# (see tests/README.md, "Notes").

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

MODE="${1:-}"
if [ "$MODE" = "-h" ] || [ "$MODE" = "--help" ]; then
    sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
    exit 0
fi
if [ -z "$MODE" ]; then
    sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//' >&2
    exit 1
fi

COMPOSE_FILE="$REPO_ROOT/compose.test.yaml"
compose() {
    docker compose -f "$COMPOSE_FILE" "$@"
}

# Services that must stay up while a runner executes. Torn down on exit,
# even when the run fails (set -e aborts straight into the trap).
STACK_UP=0
cleanup() {
    if [ "$STACK_UP" = 1 ]; then
        step "Tearing down the test stack"
        compose down >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

case "$MODE" in
    unit)
        step "Building the unit image"
        compose build unit
        step "Running unit tests"
        compose run --rm unit
        ;;

    api)
        step "Building the test stack (server-test, api)"
        compose build server-test api
        step "Starting server-test"
        compose up -d server-test
        STACK_UP=1
        step "Running Bruno API tests"
        compose run --rm api
        ;;

    e2e)
        step "Building the test stack (server-test, client-test, e2e)"
        compose build server-test client-test e2e
        step "Starting server-test + client-test"
        compose up -d server-test client-test
        STACK_UP=1
        step "Running Playwright e2e + api tests"
        compose run --rm e2e
        ;;

    all)
        step "Building the test stack (server-test, client-test, e2e, api)"
        compose build server-test client-test e2e api
        step "Starting server-test + client-test"
        compose up -d server-test client-test
        STACK_UP=1
        step "Running Bruno API tests"
        compose run --rm api
        step "Running Playwright e2e + api tests"
        compose run --rm e2e
        ;;

    *)
        die "unknown mode: '$MODE' (expected unit, api, e2e, or all)"
        ;;
esac

step "Tests passed"
