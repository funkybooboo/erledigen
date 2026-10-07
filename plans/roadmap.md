# Roadmap

The queue. Versions are the release cadence; stories are the work
(one file each in [stories/](./stories/)); the product constitution is
[identity.md](./identity.md); the shipped record is
[history.md](./history.md). Every change serves one of the three roles
-- app user, operator, developer (ADR-017).

## Where we stand (2026-10-07)

- Package version tracks the LAST SHIPPED milestone: `0.10.0` since
  the `v0.10.0` release. Releases go through PRs (main is
  branch-protected) via `tools/release.sh`, which also writes the
  CHANGELOG section and creates the GitHub Release.
- Shipped complete: v0.1.0 through v0.10.0 (the full record, with the
  as-built notes, lives in [history.md](./history.md)).
- **v0.10.1 (Platform and roles) is ACTIVE** -- the milestone that
  makes the repo serve all three roles: AGPL-3.0-only (ADR-016),
  stories as the unit of work (ADR-017), the deployment architecture
  (ADR-018: GHCR images, compose canonical, Helm for k8s), no
  tracking anywhere (ADR-019), docs by role (ADR-020).
- Policy: numeric order -- always complete the lowest incomplete
  version before starting anything higher. The recorded exceptions
  stand: the v0.14.0 time grid is deferred (ADR-014) and the polish
  pass (v0.18.0) runs last so it lands on final surfaces.

---

## v0.10.1: Platform and roles (ACTIVE)

| Story | What it earns | Status |
|-------|---------------|--------|
| [BUILD-1](./stories/BUILD-1-know-the-license.md) | License clarity (AGPL-3.0-only, ADR-016) | done |
| [BUILD-2](./stories/BUILD-2-work-story-first.md) | Story-first plans + enforced linkage (ADR-017) | doing |
| [USE-1](./stories/USE-1-docs-for-my-role.md) | docs/use, docs/host, docs/build (ADR-020) | doing |
| [HOST-1](./stories/HOST-1-install-from-images.md) | Install from published images (GHCR) | doing |
| [HOST-2](./stories/HOST-2-run-on-kubernetes.md) | Kubernetes via Helm chart | planned |
| [HOST-3](./stories/HOST-3-graceful-shutdown.md) | Restarts without dropped requests | planned |
| [HOST-4](./stories/HOST-4-liveness-readiness.md) | Distinct liveness + readiness | planned |
| [HOST-5](./stories/HOST-5-upgrade-runbook.md) | A boring upgrade path | planned |
| [HOST-6](./stories/HOST-6-backup-restore-runbook.md) | Backup + restore, documented | planned |
| [HOST-7](./stories/HOST-7-configuration-reference.md) | Every knob in one table | planned |
| [HOST-8](./stories/HOST-8-monitoring-hookup.md) | Monitoring hookup docs | planned |

## v0.11.0: Theming and customization

[USE-2 theme modal](./stories/USE-2-theme-modal.md),
[USE-3 accent schemes](./stories/USE-3-accent-schemes.md),
[USE-4 tag colors](./stories/USE-4-tag-colors.md),
[USE-5 tag management](./stories/USE-5-tag-management.md),
[USE-6 animations](./stories/USE-6-animations.md),
[USE-7 remaining preferences](./stories/USE-7-preference-set.md),
[USE-8 privacy documented](./stories/USE-8-privacy-documented.md).

## v0.12.0: Accessibility

[USE-9 keyboard operability](./stories/USE-9-full-keyboard-operability.md),
[USE-10 screen reader flows](./stories/USE-10-screen-reader-flows.md),
[USE-11 contrast + reduced motion](./stories/USE-11-contrast-reduced-motion.md),
[USE-12 labeled forms](./stories/USE-12-labeled-forms.md),
[USE-13 automated a11y audit](./stories/USE-13-automated-a11y-audit.md).

## v0.13.0: Internationalization

[USE-14 the app in my language](./stories/USE-14-my-language.md),
[USE-15 locale formatting](./stories/USE-15-locale-formatting.md),
[BUILD-3 i18n infrastructure](./stories/BUILD-3-i18n-infrastructure.md).

## v0.14.0: Calendar time grid -- deferred

An hour grid is Google Calendar's shape, not a calendar book's; it
fights the identity (ADR-014). Time-awareness ships where the user
lives instead (times + arrival ordering v0.17.0, sections, month
density v0.18.0, `.ics` as the bridge). Revisit only if lived
experience demands minute-precision after v0.17.0.

## v0.16.0: Projects as umbrellas (ADR-011)

[USE-16 someday tabs + lists](./stories/USE-16-someday-tabs-lists.md),
[USE-17 project home](./stories/USE-17-project-home.md),
[USE-18 scheduling bridge](./stories/USE-18-scheduling-bridge.md)
(removes the v0.9.0 Kanban, activate, and dependency locks),
[USE-19 project milestones](./stories/USE-19-project-milestones.md).

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

- v2.0.0 [BUILD-4 CLI](./stories/BUILD-4-cli.md)
- v2.1.0 [BUILD-5 MCP server](./stories/BUILD-5-mcp-server.md)
- v2.2.0 [USE-38 reminders](./stories/USE-38-reminders.md)
- v2.3.0 [USE-39 multi-user auth](./stories/USE-39-multi-user-auth.md) +
  [HOST-10 PostgreSQL at scale](./stories/HOST-10-postgresql-scale.md)
- v2.4.0 [HOST-11 security hardening](./stories/HOST-11-security-hardening.md)
- v2.5.0 [HOST-12 SaaS billing, inert when off](./stories/HOST-12-saas-billing.md)
- v2.6.0 [USE-40 capacity + automation](./stories/USE-40-capacity-automation.md)
- v2.7.0 [USE-41 Canvas sync](./stories/USE-41-canvas-sync.md)