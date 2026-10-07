# ADR-020: Documentation by Role: Use / Host / Build

**Status**: Accepted
**Date**: 2026-10-07

## Context

The docs today split by audience into `docs/users/` (app users) and
`docs/devs/` (developers) -- but the repo now serves a third role with
no documentation home: the **operator** who runs an instance
(self-hosted or hosted). Installation, configuration, upgrades,
backups, and monitoring are currently fragments of README and
getting-started aimed at people who already have the repo checked out.

Established self-hostable products organize documentation by what the
reader is there to do (n8n: get-started / build / deploy / administer),
which maps cleanly onto role: use the app, host an instance, build on
the code.

## Decision

`docs/` reorganizes into three role homes whose names match the story
prefixes (ADR-017):

- **`docs/use/`** -- app users: what the app is, how to work in it,
  notes, import/export. (Today's `docs/users/` moves here.)
- **`docs/host/`** -- operators: install (compose and Kubernetes),
  the configuration reference, upgrades, backups, monitoring,
  troubleshooting. (New.)
- **`docs/build/`** -- developers: architecture, standards, process,
  ADRs, and everything needed to contribute. (Today's `docs/devs/`
  moves here.)

Supporting decisions:

1. `CONTRIBUTING.md` stays at the repo root (it is a GitHub-special
   file) and routes readers to the role home that fits them.
2. The repo docs are the single source of truth; they are served as
   assets where needed (in-app links, GitHub rendering). No separate
   hosted-docs site is committed to.
3. The roadmap's old "hosted on Writebook" wording is retired; the
   in-app docs-link story links to the repo docs.

## Rationale

Each role gets a first-class entry and a complete story, and the
naming makes the story system's prefixes self-explanatory (a `HOST-`
story lands its documentation in `docs/host/`). The verb form also
travels: "how do I use / host / build erledigen" is how people ask the
question.

## Consequences

- `docs/users/` -> `docs/use/`, `docs/devs/` -> `docs/build/`; every
  cross-reference in the tree updates (lychee enforces this in CI).
- `docs/host/` is authored from scratch as part of the platform
  milestone.
- The documentation-standards doc gains the role split and the
  "every doc names its role" rule.