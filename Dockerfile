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
# Vite inlines VITE_* vars at build time, so the API URL is a build arg.
FROM base AS build-client
ARG VITE_API_URL
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
WORKDIR /app
COPY --from=oven/bun:${BUN_VERSION}-alpine /usr/local/bin/bun /usr/local/bin/bun
COPY --from=oven/bun:${BUN_VERSION}-alpine /usr/local/bin/bunx /usr/local/bin/bunx
COPY bun.lock package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN bun install --prod --frozen-lockfile
COPY --from=build-client /app/packages/client/build ./build
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
EXPOSE 3000
CMD ["node", "build"]

# ---- e2e test runner ---------------------------------------------------------
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION} AS e2e
COPY --from=oven/bun:${BUN_VERSION} /usr/local/bin/bun /usr/local/bin/bun
COPY --from=oven/bun:${BUN_VERSION} /usr/local/bin/bunx /usr/local/bin/bunx
WORKDIR /app
COPY bun.lock package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN bun install --frozen-lockfile
COPY . .
CMD ["bunx", "playwright", "test"]
