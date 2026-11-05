# BUILD-5: One asserted API suite

As a developer, I want exactly one automated API test suite and a
browser-served explorer for the live API, so that every API behavior
is asserted in exactly one place, and the surface stays discoverable
without a hand-maintained mirror.

**Status**: done
**Version**: v0.13.1

## Acceptance criteria

- [x] The Playwright `api` project is the only automated API suite;
      anything Bruno asserted exists there (or in a unit test where it
      belongs)
- [x] The unique value of the second client is ported deliberately:
      realistic Accept-header shapes (the axios/Bruno default list)
      are asserted end to end
- [x] The Bruno collection, its CI job, compose service, and every
      `test-api` entry point are gone
- [x] Swagger UI is served by the API server at `/api/docs` (behind
      the prod proxy's `/api/*` route) against the OpenAPI spec, with
      vendored assets (no CDN, works offline)
- [x] ADR-024 records the decision; the docs no longer describe two
      API suites

## Notes

Bruno grew from the TDD workflow (write `.bru` first, port later) and
stayed as a CI gate, duplicating the Playwright suite's assertions
with a maintenance tax on every endpoint change. The one real bug it
caught (the substring-matching content negotiation) came from client
diversity, not from its assertions -- so that diversity is what gets
ported. See ADR-024.

As-built (2026-10-10, PRs #80 + #88): the Playwright `api` project
is the only suite -- the Bruno collection, its compose service, its
CI job, mise `test-api`, and package.json `test:api`/`test:all` are
gone, and `test-stack all` now runs unit + e2e. The client diversity
that caught the one real bug is what got ported: the
content-negotiation block in `tests/api/tasks.spec.ts` asserts the
realistic client Accept shapes (the axios list, the curl wildcard,
q-weighted) end to end over the negotiate() unit matrix, and the api
project no longer force-sends `Accept: application/json` (that masked
exactly the paths the specs exist to prove). The rate-limit `.bru`
asserted nothing (200 and 429 both green); the limiter stays covered
by rateLimiter.test.ts + BunHttpServer.test.ts, which assert the
exact 429 body shape through the real adapter. The explorer is
vendored Swagger UI (swagger-ui-dist 5.33.1, Apache-2.0,
REUSE-annotated) served by the API server at `/api/docs` -- under
`/api/*` because the prod edge proxy routes only `/api/*` and `/ws`
-- rendered from the spec the route-parity test keeps honest:
`/api/openapi.json` is the proxy-reachable alias, assets go through
an exact-name whitelist, the page carries its own CSP (the
security-headers middleware lets a handler-supplied CSP through),
and there is no CDN -- a self-hosted instance works offline. ADR-024
records the decision; tests/README.md, testing.md, and
getting-started.md describe the one suite and the explorer.