# ADR-021: Automation Surface: CLI Only, No MCP Server (supersedes ADR-014's sanctioned "CLI/MCP server" surface)

**Status:** Accepted
**Date:** 2026-10-07

## Context

"No AI in the UI" is a standing rule (ADR-014's coherence pass): AI
automation, if it ever ships, lives outside the UI, never in it. At
the 2026-10-07 planning pass the sanctioned outside-the-UI surface
was recorded as "CLI/MCP server" -- two surfaces, with the roadmap's
v2.0.0 arc carrying both stories: BUILD-4 (the CLI) and BUILD-5 (an
MCP server package for assistant/agent integration).

BUILD-5 asks the maintenance question a second server package always
asks: build it, secure it, document it, version it -- for a
single-user, self-hosted, privacy-first product.

## Decision

**The CLI alone is the automation surface.** BUILD-5 (the MCP server
story) is dropped; the v2.x arc renumbers without it (reminders
v2.1.0, multi-user auth + PostgreSQL v2.2.0, security hardening
v2.3.0, SaaS billing v2.4.0, capacity + automation v2.5.0, Canvas
sync v2.6.0).

1. The CLI (BUILD-4) carries the automation surface: the same
   natural-language grammar as the app, an interactive TUI mirroring
   the web shortcut table, and `--format json|plain|csv` for
   scripting.
2. An assistant that can run commands has the parity an MCP server
   would have offered -- no second server package to build, secure,
   document, and version.
3. Smart scheduling (USE-40) stays CLI-only with the UI rule: no
   scheduling intelligence renders in the app.
4. design.md, BUILD-4, and USE-40 follow the decision.

## Rationale

- The MCP server duplicates a surface the CLI already provides:
  any agent that could speak to an MCP server can already run a CLI
  command -- and the CLI has strictly more users (humans) than an
  MCP endpoint would.
- A server package is a permanent security and versioning liability
  (auth surface, protocol churn, release cadence) that a
  single-user product does not need.
- One surface means the automation story gets documented once, in
  one place, with the web UI -- the same grammar everywhere.

## Consequences

### Positive

- One automation surface: the CLI, with the app's own grammar.
- The v2.x arc focuses on the hosted-services essentials (auth,
  hardening, billing) instead of protocol plumbing.

### Negative

- Tooling that speaks MCP natively (assistant clients without
  shell access) must integrate through the CLI or the HTTP API
  rather than a first-party MCP endpoint.

### Mitigations

- The HTTP API (ADR-024's documented OpenAPI surface) remains the
  integration point for anything that cannot run the CLI.
- A future reversal is a new ADR, not an edit to this one.

---

*Provenance: the decision landed in PR #52 (2026-10-07), which
updated the ADR index, the roadmap, design.md, and the stories --
but the ADR file itself was never committed, leaving the index
entry dangling. This file was written on 2026-11-06 from the
surviving record: PR #52's commit message, the story edits it
carried, and the index entry, per the repo's rule that ADRs are
the record for decisions.*
