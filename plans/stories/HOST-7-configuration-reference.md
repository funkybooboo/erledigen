# HOST-7: One configuration reference

As an operator, I want every environment variable and default in one
table, so that configuring an instance does not require reading
source code.

**Status**: done
**Version**: v0.10.1

## Acceptance criteria
- [x] docs/host/ configuration reference: every env var, its default,
      what it does, and which container consumes it
- [x] Covers server (port, CORS, storage adapter, DB path, rate
      limit, log format/level, metrics, job knobs), client (API URL,
      port), and compose-level vars
- [x] No dev-doc duplication: getting-started links here

## Notes

ADR-018. The data exists today; it is split across getting-started
and README.
