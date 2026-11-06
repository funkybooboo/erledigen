# Roadmap

The queue. Versions are the release cadence; stories are the work
(one file each in [stories/](./stories/)); the product constitution is
[identity.md](./identity.md); the shipped record is
[history.md](./history.md). Every change serves one of the three roles
-- app user, operator, developer (ADR-017).

## Where we stand (2026-11-06)

- Package version tracks the LAST SHIPPED milestone: `0.16.0` since
  the `v0.16.0` release. Releases go through PRs (main is
  branch-protected) via `tools/release.sh`, which also writes the
  CHANGELOG section and creates the GitHub Release.
- Shipped complete: v0.1.0 through v0.16.0 (the full record, with the
  as-built notes, lives in [history.md](./history.md)).
- **v0.17.0 (Routines, ADR-012, ADR-013) is NEXT** -- the lowest
  incomplete version; the recorded v0.14.0 deferral stands (the hour
  grid fights the identity, ADR-014). The snapshot version sequence
  is recorded: v2 shipped with v0.16.0 (ADR-026); the routines rename
  takes v3. The standing dependency policy (ADR-025) applies:
  advisories land on the triage order, they never wait for a release
  to be triaged.
- Policy: numeric order -- always complete the lowest incomplete
  version before starting anything higher. The recorded exceptions
  stand: the v0.14.0 time grid is deferred (ADR-014) and the polish
  pass (v0.18.0) runs last so it lands on final surfaces.

---

## v0.14.0: Calendar time grid -- deferred

An hour grid is Google Calendar's shape, not a calendar book's; it
fights the identity (ADR-014). Time-awareness ships where the user
lives instead (times + arrival ordering v0.17.0, sections, month
density v0.18.0, `.ics` as the bridge). Revisit only if lived
experience demands minute-precision after v0.17.0.

## v0.17.0: Routines (ADR-012, ADR-013)

[USE-20 the rename](./stories/USE-20-routines-rename.md),
[USE-21 schedule grammar](./stories/USE-21-schedule-grammar.md),
[USE-22 NL + control blend](./stories/USE-22-nl-control-blend.md),
[USE-23 routines modal](./stories/USE-23-routines-modal.md),
[USE-24 reshape the future](./stories/USE-24-reshape-the-future.md),
[USE-25 routine rows](./stories/USE-25-routine-rows.md),
[USE-26 arrival ordering](./stories/USE-26-arrival-ordering.md)
(retires the priority sort), [USE-27 in-day sections](./stories/USE-27-in-day-sections.md).

## v0.18.0: Gold-standard polish

[USE-28 struck-through completion](./stories/USE-28-completed-rows.md),
[USE-29 drag the task](./stories/USE-29-drag-the-task.md),
[USE-30 filter by title](./stories/USE-30-filter-by-title.md),
[USE-31 calendar density](./stories/USE-31-calendar-density.md),
[USE-32 Stats rename](./stories/USE-32-stats-rename.md),
[USE-33 docs link](./stories/USE-33-docs-link.md),
[USE-34 no store counter](./stories/USE-34-no-store-counter.md),
[USE-35 print the week](./stories/USE-35-print-the-week.md),
[USE-36 notification modal](./stories/USE-36-notification-modal.md),
[USE-37 calendar-book polish](./stories/USE-37-calendar-book-polish.md)
(includes the `/` palette removal).

## v1.0.0: Public release (the gate)

Everything above, integrated end to end -- a complete daily driver for
one self-hosted user. The gate:

- All v0.10.1-v0.18.0 stories done; every remaining UX-audit finding
  shipped or closed with a recorded decision.
- [HOST-9 the monitoring stack](./stories/HOST-9-monitoring-stack.md)
  ships here.
- Performance: day list loads <100ms; lazy loading keeps scroll smooth.
- Full keyboard operation, AA accessibility, import/export across all
  formats -- as delivered by their stories.
- Single user, no authentication (the hosted-services arc starts
  after 1.0).

## v2.x: The hosted-services arc

- v2.0.0 [BUILD-4 CLI](./stories/BUILD-4-cli.md) -- the automation
  surface (ADR-021: CLI only, no MCP server)
- v2.1.0 [USE-38 reminders](./stories/USE-38-reminders.md)
- v2.2.0 [USE-39 multi-user auth](./stories/USE-39-multi-user-auth.md) +
  [HOST-10 PostgreSQL at scale](./stories/HOST-10-postgresql-scale.md)
- v2.3.0 [HOST-11 security hardening](./stories/HOST-11-security-hardening.md)
- v2.4.0 [HOST-12 SaaS billing, inert when off](./stories/HOST-12-saas-billing.md)
- v2.5.0 [USE-40 capacity + automation](./stories/USE-40-capacity-automation.md)
- v2.6.0 [USE-41 Canvas sync](./stories/USE-41-canvas-sync.md)