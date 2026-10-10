# BUILD-5: One asserted API suite

As a developer, I want exactly one automated API test suite and a
browser-served explorer for the live API, so that every API behavior
is asserted in exactly one place, and the surface stays discoverable
without a hand-maintained mirror.

**Status**: doing
**Version**: v0.13.1

## Acceptance criteria

- [ ] The Playwright `api` project is the only automated API suite;
      anything Bruno asserted exists there (or in a unit test where it
      belongs)
- [ ] The unique value of the second client is ported deliberately:
      realistic Accept-header shapes (the axios/Bruno default list)
      are asserted end to end
- [ ] The Bruno collection, its CI job, compose service, and every
      `test-api` entry point are gone
- [ ] Swagger UI is served by the API server at `/api/docs` (behind
      the prod proxy's `/api/*` route) against the OpenAPI spec, with
      vendored assets (no CDN, works offline)
- [ ] ADR-024 records the decision; the docs no longer describe two
      API suites

## Notes

Bruno grew from the TDD workflow (write `.bru` first, port later) and
stayed as a CI gate, duplicating the Playwright suite's assertions
with a maintenance tax on every endpoint change. The one real bug it
caught (the substring-matching content negotiation) came from client
diversity, not from its assertions -- so that diversity is what gets
ported. See ADR-024.