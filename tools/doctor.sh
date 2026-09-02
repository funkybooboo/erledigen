#!/usr/bin/env bash
# Pre-flight environment check: is this machine able to build, test, and run
# Erledigen right now? Read-only; fixes nothing; exit code is 1 if any check
# FAILED (warnings do not fail).
#
# Usage:
#   tools/doctor.sh

# No set -e: every check below manages its own failure mode. nounset and
# pipefail stay on so bugs in the script itself still surface.
set -uo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

OK_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

ok() {
    printf '    [OK]    %s\n' "$*"
    OK_COUNT=$((OK_COUNT + 1))
}
warn() {
    printf '    [WARN]  %s\n' "$*"
    WARN_COUNT=$((WARN_COUNT + 1))
}
fail() {
    printf '    [FAIL]  %s\n' "$*"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}
info() {
    printf '    [....]  %s\n' "$*"
}

# -- mise and tool pins --------------------------------------------------------

step "mise and tool pins"
if command -v mise >/dev/null 2>&1; then
    ok "mise $(mise --version 2>/dev/null | head -1)"
    if mise tasks >/dev/null 2>&1; then
        ok "mise.toml task registry parses"
    else
        fail "mise.toml does not parse (run: mise tasks)"
    fi
else
    fail "mise not found -- see docs/devs/process/getting-started.md"
fi

# Three-way bun sync: running bun == mise.toml pin == Dockerfile build arg.
# The Dockerfile header demands these stay in sync; drift here is how
# "works locally, red in CI" happens.
MISE_BUN="$(grep -m1 '^bun = ' "$REPO_ROOT/mise.toml" | sed 's/[^0-9.]*//g')"
DOCKERFILE_BUN="$(grep -m1 '^ARG BUN_VERSION=' "$REPO_ROOT/Dockerfile" | sed 's/[^0-9.]*//g')"
if command -v bun >/dev/null 2>&1; then
    RUNNING_BUN="$(bun --version)"
    if [ -n "$MISE_BUN" ] && [ "$RUNNING_BUN" = "$MISE_BUN" ]; then
        ok "bun $RUNNING_BUN matches the mise.toml pin"
    else
        fail "bun $RUNNING_BUN != mise.toml pin $MISE_BUN (run: mise install)"
    fi
    if [ -n "$DOCKERFILE_BUN" ] && [ "$MISE_BUN" = "$DOCKERFILE_BUN" ]; then
        ok "mise.toml and Dockerfile agree on bun $DOCKERFILE_BUN"
    else
        fail "bun version drift: mise.toml $MISE_BUN vs Dockerfile $DOCKERFILE_BUN"
    fi
else
    fail "bun not found on PATH (is mise activated in this shell?)"
fi

# Playwright: the e2e image bundles the version from the Dockerfile arg;
# bun.lock pins the test library. They must match or the bundled Chromium
# is the wrong one for the @playwright/test in the lockfile.
DOCKERFILE_PW="$(grep -m1 '^ARG PLAYWRIGHT_VERSION=' "$REPO_ROOT/Dockerfile" | sed 's/[^0-9.]*//g')"
LOCK_PW="$(grep -m1 -o '@playwright/test@[0-9][0-9.]*' "$REPO_ROOT/bun.lock" | sed 's/.*@//' || true)"
if [ -n "$DOCKERFILE_PW" ] && [ -n "$LOCK_PW" ] && [ "$DOCKERFILE_PW" = "$LOCK_PW" ]; then
    ok "playwright in sync: Dockerfile $DOCKERFILE_PW == bun.lock $LOCK_PW"
else
    fail "playwright drift: Dockerfile $DOCKERFILE_PW vs bun.lock $LOCK_PW"
fi

# Optional tools for the quality tasks.
if command -v lychee >/dev/null 2>&1; then
    ok "lychee present (check-links)"
else
    warn "lychee missing -- mise run check-links will fail (run: mise install)"
fi
if command -v gitleaks >/dev/null 2>&1; then
    ok "gitleaks present (scan-secrets)"
else
    warn "gitleaks missing -- mise run scan-secrets will fail (run: mise install)"
fi

# -- docker --------------------------------------------------------------------

step "docker"
if command -v docker >/dev/null 2>&1; then
    # podman's docker wrapper does not template .ServerVersion, so try the
    # formatted query first and fall back to plain `docker info`.
    SERVER_VERSION="$(docker info -f '{{.ServerVersion}}' 2>/dev/null || true)"
    if [ -n "$SERVER_VERSION" ]; then
        ok "docker daemon reachable (server $SERVER_VERSION)"
    elif docker info >/dev/null 2>&1; then
        ok "docker daemon reachable (podman-backed; no templated version field)"
    else
        fail "docker CLI present but the daemon is unreachable (start it, or check the podman socket)"
    fi
    if docker compose version >/dev/null 2>&1; then
        ok "docker compose available"
    else
        fail "docker compose missing -- every stack and test task needs it"
    fi
else
    fail "docker not found -- dev/prod/test stacks all need it"
fi

# -- dev/prod ports -------------------------------------------------------------

step "ports (3000 dev client, 4000 dev server, 8080 prod)"
if command -v ss >/dev/null 2>&1; then
    PORTS_BUSY="$(ss -tlnH 2>/dev/null | awk '{ print $4 }' | grep -E ':(3000|4000|8080)$' | sort -u || true)"
    if [ -n "$PORTS_BUSY" ]; then
        while IFS= read -r line; do
            warn "$line is already bound (a stack already up? compose up will fail to publish it)"
        done <<<"$PORTS_BUSY"
    else
        ok "3000 / 4000 / 8080 are all free"
    fi
else
    info "ss not available -- skipping the port check"
fi

# -- repo state ------------------------------------------------------------------

step "repo state"
if [ -d "$REPO_ROOT/node_modules" ]; then
    ok "node_modules present"
else
    warn "node_modules missing (run: mise run install)"
fi

FROZEN_RC=0
FROZEN_OUT="$(from_root bun install --frozen-lockfile 2>&1)" || FROZEN_RC=$?
if [ "$FROZEN_RC" -eq 0 ]; then
    ok "bun.lock is in sync with the manifests (frozen install passes)"
else
    fail "bun.lock out of sync with the manifests:
$(printf '%s' "$FROZEN_OUT" | tail -3 | sed 's/^/           /')"
fi

BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
DIRTY_COUNT="$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null | wc -l | tr -d ' ')"
info "branch: $BRANCH, dirty files: $DIRTY_COUNT"
if UPSTREAM="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref '@{upstream}' 2>/dev/null)"; then
    COUNTS="$(git -C "$REPO_ROOT" rev-list --left-right --count "$UPSTREAM...HEAD" 2>/dev/null || echo '?')"
    BEHIND="$(printf '%s' "$COUNTS" | awk '{print $1}')"
    AHEAD="$(printf '%s' "$COUNTS" | awk '{print $2}')"
    info "vs $UPSTREAM: behind $BEHIND, ahead $AHEAD"
else
    info "no upstream tracking branch"
fi

# -- git hooks --------------------------------------------------------------------

step "git hooks (husky)"
HOOKS_PATH="$(git -C "$REPO_ROOT" config core.hooksPath || true)"
case "$HOOKS_PATH" in
    .husky | .husky/*)
        if [ -d "$REPO_ROOT/$HOOKS_PATH" ]; then
            ok "husky hooks active (core.hooksPath=$HOOKS_PATH)"
        else
            warn "core.hooksPath=$HOOKS_PATH but that directory is missing (run: bun run prepare)"
        fi
        ;;
    *)
        warn "husky hooks not active (core.hooksPath=${HOOKS_PATH:-unset}) -- commit lint and lint-staged will not run (run: bun run prepare)"
        ;;
esac

# -- local playwright browsers (optional; the docker test image bundles its own) --

step "local Playwright browsers"
if ls -d "$HOME"/.cache/ms-playwright/chromium* >/dev/null 2>&1; then
    ok "Chromium cached for local bun run test:e2e runs"
else
    info "no local browsers cached -- fine for dockerized runs; for local runs: mise run install-playwright"
fi

# -- disk ---------------------------------------------------------------------------

step "disk space (docker image builds need headroom)"
AVAIL="$(df -h "$REPO_ROOT" | awk 'NR==2 { print $4 }')"
case "$AVAIL" in
    *T) ok "$AVAIL free" ;;
    *G)
        GIGS="${AVAIL%G}"
        if [ "${GIGS%.*}" -ge 10 ]; then
            ok "$AVAIL free"
        else
            warn "only $AVAIL free -- a fresh image build may not fit"
        fi
        ;;
    *) warn "only $AVAIL free -- a fresh image build may not fit" ;;
esac

# -- summary ------------------------------------------------------------------------

step "Summary: $OK_COUNT ok, $WARN_COUNT warnings, $FAIL_COUNT failures"
if [ "$FAIL_COUNT" -gt 0 ]; then
    die "fix the [FAIL] items above before relying on this environment"
fi
if [ "$WARN_COUNT" -gt 0 ]; then
    note "warnings are non-fatal, but read them once"
fi
note "environment is ready"