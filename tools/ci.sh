#!/usr/bin/env bash
# Run the full CI pipeline locally -- a faithful mirror of
# .github/workflows/ci.yml.
#
# Lint, types, and builds run against the working tree; unit, api, and e2e
# tests run inside the dockerized test stack (compose.test.yaml). No local
# servers are started or killed.
#
# Usage:
#   tools/ci.sh

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

cd "$REPO_ROOT"

step "Install dependencies (frozen lockfile)"
bun install --frozen-lockfile

step "Biome (lint + format, CI mode)"
bun run check:ci

step "Spell-check (cspell)"
bun run spellcheck

step "Link check (lychee)"
bun run check-links

step "Secret scan (gitleaks)"
bun run scan-secrets

step "Type-check (all packages)"
bun run type-check

step "Unit tests (dockerized)"
"$TOOLS_DIR/test-stack.sh" unit

step "API + e2e tests (dockerized)"
"$TOOLS_DIR/test-stack.sh" all

step "Build all packages + bundle-size budget"
"$TOOLS_DIR/build.sh"

step "Build Storybook"
(cd packages/client && bun run build-storybook)

step "Security audit (bun audit)"
if ! bun audit; then
    note "WARNING: security vulnerabilities found -- review required (non-fatal, matches CI)"
fi

step "CI pipeline passed"
