#!/usr/bin/env bash
# Build the app packages locally: server -> client, plus the client
# bundle-size budget. This does NOT build docker images -- use
# tools/build-images.sh for those (the compose stacks build them on demand).
#
# (The shared package has no standalone build: both consumers bundle it
# straight from source -- the server via `bun build`, the client via vite --
# and its types are enforced by type-check. A shared `dist/` was produced
# here for a while and consumed by nothing.)
#
# The budget (676 KiB by default, on the browser payload) mirrors the gate
# documented in .github/workflows/ci.yml. Override it with MAX_CLIENT_BYTES;
# set MAX_CLIENT_BYTES=0 to skip the check entirely.
#
# History: 664 KiB was the pre-v0.11.0 ceiling; raised +12 KiB once for the
# v0.11.0 theming build (Theme modal, accent schemes, tag colors/management,
# animations, preference UIs) so each story PR does not whack the gate --
# re-evaluate at the v1.0.0 gate.

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DEFAULT_MAX_BYTES=692224 # 676 KiB
MAX_BYTES="${MAX_CLIENT_BYTES:-$DEFAULT_MAX_BYTES}"

step "Building server"
(cd "$REPO_ROOT/packages/server" && bun run build)

step "Building client"
(cd "$REPO_ROOT/packages/client" && bun run build)

# -- client bundle size gate ---------------------------------------------------
#
# adapter-node emits packages/client/build/{client,server,...}: `client/` is
# the browser payload (what the budget measures); `server/` is node-side and
# never ships to browsers. Sourcemaps are excluded for the same reason.
# NOTE: the old CI gate pointed at packages/client/dist -- a path that never
# existed -- so it vacuously passed forever; this is the real gate.

CLIENT_OUTPUT="$REPO_ROOT/packages/client/build/client"
if [ ! -d "$CLIENT_OUTPUT" ]; then
    die "client build output not found at packages/client/build/client"
fi

# Byte-accurate and portable: du -sb is GNU-only, and du -sk block-rounds
# small files (overshoots the budget by ~20%).
SIZE_BYTES="$(bun -e '
const fs = require("fs");
let total = 0;
const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const path = dir + "/" + entry.name;
        if (entry.isDirectory()) walk(path);
        else if (!path.endsWith(".map")) total += fs.statSync(path).size;
    }
};
walk(process.argv[1]);
console.log(total);
' "$CLIENT_OUTPUT")"

# Guard against a silently-broken walker: arithmetic on NaN/empty always
# compares false, which would let an oversized bundle pass.
if ! [[ "$SIZE_BYTES" =~ ^[0-9]+$ ]]; then
    die "could not measure the client bundle size (got: '$SIZE_BYTES')"
fi

if [ "$MAX_BYTES" = "0" ]; then
    step "Client bundle size: $SIZE_BYTES bytes (budget check skipped)"
    exit 0
fi

step "Client bundle size: $SIZE_BYTES bytes (budget: $MAX_BYTES bytes)"
if [ "$SIZE_BYTES" -gt "$MAX_BYTES" ]; then
    die "client bundle exceeds the $MAX_BYTES byte budget -- trim it or consciously raise MAX_CLIENT_BYTES / the ci.yml gate"
fi
note "OK ($(( (MAX_BYTES - SIZE_BYTES) * 100 / MAX_BYTES ))% headroom)"