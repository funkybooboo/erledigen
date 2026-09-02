# syntax=docker/dockerfile:1

# =============================================================================
# Erledigen -- single multi-stage Dockerfile.
#
# Compose selects the stage it needs via build.target:
#
#   development       bun + workspace deps + source. Dev containers bind-mount
#                     the repo over /app (deps preserved via anonymous
#                     volumes); test containers use the baked-in source with
#                     no mounts at all.
#   production-server minimal bun runtime + the server's bun-build bundle.
#   production-client node runtime + the SvelteKit adapter-node build output.
#   e2e               mcr.microsoft.com/playwright base (bundled Chromium +
#                     system deps) + bun + source; runs the Playwright suites
#                     against the compose test stack.
#
# Version pins (bun matches mise.toml; playwright must match bun.lock):
#   BUN_VERSION        -- also keep mise.toml in sync
#   PLAYWRIGHT_VERSION -- must equal the @playwright/test version in bun.lock
# =============================================================================

ARG BUN_VERSION=1.3.10
ARG PLAYWRIGHT_VERSION=1.62.1

# ---- bun binary sources -----------------------------------------------------
# BuildKit does not support variable expansion in `COPY --from=<image>`
# ("variable expansion is not supported for --from"), so the bun binaries
# are provided through real stages -- FROM may use the global ARGs above --
# and later stages copy from these stage names instead of
# oven/bun:${BUN_VERSION}. Stages a target never references are not built,
# so this adds nothing to builds that do not need the binaries.
FROM oven/bun:${BUN_VERSION} AS bun-dist
FROM oven/bun:${BUN_VERSION}-alpine AS bun-alpine-dist

# ---- base: workspace manifests + dependencies (shared by all bun stages) ----
FROM oven/bun:${BUN_VERSION} AS base
WORKDIR /app

# Manifests only, so `bun install` stays cached across source edits.
COPY bun.lock package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN bun install --frozen-lockfile

# ---- development -------------------------------------------------------------
FROM base AS development
COPY . .

# ---- server build ------------------------------------------------------------
# `bun build --target bun` bundles the workspace (including @erledigen/shared
# source) into dist/ and copies the SQL migrations next to it.
FROM base AS build-server
COPY packages/shared packages/shared
COPY packages/server packages/server
RUN bun run --cwd packages/server build

# ---- client build ------------------------------------------------------------
# Vite inlines VITE_* vars at build time. An EMPTY (or unset) VITE_API_URL
# builds the client same-origin ("this page's origin") -- that is what the
# prod stack serves via the reverse proxy (deploy/Caddyfile), and it keeps
# the image host/domain-agnostic. Pass an absolute URL only for
# split-origin deployments. See packages/client/src/lib/apiBaseUrl.ts.
FROM base AS build-client
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
COPY packages/shared packages/shared
COPY packages/client packages/client
RUN bun run --cwd packages/client build

# ---- production server -------------------------------------------------------
# bun:sqlite is built into the bun binary -- no native deps to carry over.
FROM oven/bun:${BUN_VERSION}-alpine AS production-server
WORKDIR /server
ENV NODE_ENV=production
COPY --from=build-server /app/packages/server/dist ./dist
EXPOSE 4000
CMD ["bun", "dist/index.js"]

# ---- production client -------------------------------------------------------
# SvelteKit adapter-node targets Node, so the output runs the documented
# `node build`. bun is copied in ONLY for the production dependency install
# (it reads bun.lock); the alpine bun binary matches this alpine (musl) base.
FROM node:24-alpine AS production-client
# 1. Install prod deps for the whole workspace at the monorepo root. Bun's
#    isolated linker puts each workspace's deps in its own
#    packages/*/node_modules (symlinks into /app/node_modules/.bun).
#    bun is copied in ONLY for this install (it reads bun.lock); the alpine
#    bun binary matches this alpine (musl) base.
WORKDIR /app
COPY --from=bun-alpine-dist /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun-alpine-dist /usr/local/bin/bunx /usr/local/bin/bunx
COPY bun.lock package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
# --ignore-scripts: the root `prepare: husky` script would otherwise fail
# (husky is a devDependency, absent from a prod install).
RUN bun install --prod --frozen-lockfile --ignore-scripts
# 2. Run from the client workspace so node resolves its node_modules tree.
COPY --from=build-client /app/packages/client/build ./packages/client/build
WORKDIR /app/packages/client
# No ORIGIN needed: adapter-node derives the public origin from the Host
# header, which the prod proxy (Caddy) passes through untouched.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["node", "build"]

# ---- e2e test runner ---------------------------------------------------------
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION} AS e2e
COPY --from=bun-dist /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun-dist /usr/local/bin/bunx /usr/local/bin/bunx
WORKDIR /app
COPY bun.lock package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN bun install --frozen-lockfile
COPY . .
CMD ["bunx", "playwright", "test"]
