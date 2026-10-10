# ADR-024: One Asserted API Suite (Playwright) with a Served Explorer

Date: 2026-10-10

Status: Accepted

## Context

Until now the REST surface has been exercised by two hand-maintained
suites: the Playwright `api` project (`tests/api/`, black-box
HTTP against the live server) and the Bruno collection
(`tests/api/`, ~100 `.bru` files run in CI via
`tools/test-stack.sh api`). They overlap heavily -- roughly a third of
the Bruno files are edge-case mirrors of Playwright assertions -- so
every endpoint change pays a maintenance tax twice, and the two
directories' names invite constant confusion about which is "the" API
suite.

Bruno's role grew from the TDD workflow (write a `.bru` first, port
the cases to Playwright after) -- the scaffolding stayed as a CI gate.

The one bug Bruno's CI run uniquely caught was **not** an assertion
triumph: the axios-based Bruno CLI sends
`Accept: application/json, text/plain, */*`, and the old
substring-matching `negotiate()` served plain text to every such
request while Playwright's context (which sends a bare
`application/json`) stayed green (see
`packages/server/src/utils/contentNegotiation.ts`). The value was
**client diversity** -- a second HTTP implementation with different
default headers -- not a second copy of the assertions.

Meanwhile the repo already has the idiomatic contract pieces: an
OpenAPI 3.1 spec generated from Zod schemas, enforced against the
routes by `routeParity.test.ts`, and served at `/openapi.json` /
`/openapi.yaml`.

## Decision

1. **The Playwright `api` project is the only automated API suite.**
   Anything worth asserting against the HTTP surface is asserted
   there (or, when it is pure logic, in a unit test).
2. **The client-diversity value is ported deliberately**: the suite
   asserts realistic client Accept-header shapes (the axios/Bruno
   default list, `*/*`, q-weighted lists) end to end, so the
   negotiation wiring is covered without a second client.
3. **The Bruno collection is removed** -- files, compose service,
   CI job, and every `test-api` entry point.
4. **The server serves Swagger UI at `/api/docs`** from the OpenAPI
   spec, with vendored assets (no CDN; a self-hosted instance must
   work offline). `/api/*` is the only path the prod proxy routes to
   the server, so the docs live there -- and the spec gets an
   `/api/openapi.json` alias so the UI works behind the proxy.
   Swagger UI replaces Bruno's exploration and onboarding role: a
   browsable, try-it-out catalog of every endpoint, generated from
   the same spec the parity test enforces.

## Consequences

- One place to look for API coverage; endpoint changes touch one
  suite, not two.
- The exploration surface (Swagger UI) is generated from the spec, so
  it cannot drift the way a hand-maintained collection does -- the
  parity test keeps the spec true, and the UI renders whatever the
  spec says.
- Client diversity is simulated with explicit header shapes instead of
  a second client stack; a future client with novel defaults is
  covered by adding a shape to the negotiation test, or by the
  `negotiate()` unit tests, which already carry the full parsing
  matrix.
- `~90` request recipes humans had at hand in the Bruno GUI are gone;
  Swagger UI's try-it-out covers the same need with zero upkeep.
- The rate-limit `.bru` file asserted nothing (it accepted 200 *or*
  429); rate limiting remains covered where it always was --
  `rateLimiter.test.ts` and `BunHttpServer.test.ts` assert the exact
  429 body shape through the real HTTP adapter.