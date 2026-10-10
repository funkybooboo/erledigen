# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Erledigen project.

## What is an ADR?

An ADR captures an important architectural decision: what was decided, why, and what the consequences are. ADRs are immutable once accepted -- if a decision changes, write a new ADR that supersedes the old one.

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](ADR-001-sqlite-raw-sql-persistence.md) | SQLite with Raw SQL for Persistence | Accepted | 2026-05-09 |
| [ADR-002](ADR-002-sqlite-backed-job-queue.md) | SQLite-Backed Job Queue for Background Processing | Accepted | 2026-05-09 |
| [ADR-003](ADR-003-raw-sql-migrations.md) | Raw SQL Migration Files | Accepted | 2026-05-09 |
| [ADR-004](ADR-004-structured-json-logging.md) | Structured JSON Logging & Request Tracing | Accepted | 2026-05-09 |
| [ADR-005](ADR-005-prometheus-metrics.md) | Prometheus-Compatible Metrics Endpoint | Accepted | 2026-05-09 |
| [ADR-006](ADR-006-observability-stack.md) | Observability Stack (Loki + Prometheus + Grafana) | Accepted | 2026-05-09 |
| [ADR-007](ADR-007-metric-prefix.md) | Metric Naming Prefix `erledigen_` (supersedes ADR-005 naming) | Accepted | 2026-09-05 |
| [ADR-008](ADR-008-export-format-stability.md) | Stable Export Formats and the Canonical JSON Snapshot | Accepted | 2026-09-07 |
| [ADR-009](ADR-009-import-semantics.md) | Import Semantics: Destructive Restore and Additive Imports | Accepted | 2026-09-07 |
| [ADR-010](ADR-010-automated-paper-calendar.md) | The Automated Paper Calendar: Product Identity and System Rules | Accepted | 2026-10-04 |
| [ADR-011](ADR-011-projects-as-umbrellas.md) | Projects as Umbrellas: Gathered Views Over Tags, Not Containers (supersedes the v0.9.0 Kanban design) | Accepted | 2026-10-04 |
| [ADR-012](ADR-012-export-snapshot-v2-routines-rename.md) | Export Snapshot Version 2: The Routines Rename (extends ADR-008) | Accepted | 2026-10-04 |
| [ADR-013](ADR-013-arrival-insertion-manual-sovereignty.md) | Day-List Ordering: Arrival Insertion and Manual Sovereignty (retires the priority sort mode) | Accepted | 2026-10-04 |
| [ADR-014](ADR-014-scope-boundaries.md) | Deliberate Scope Boundaries: What Erledigen Is Not | Accepted | 2026-10-04 |
| [ADR-015](ADR-015-safe-by-construction-markdown.md) | Safe-by-Construction Markdown Renderer (No DOMPurify) | Accepted | 2026-10-04 |
| [ADR-016](ADR-016-agpl-license.md) | AGPL-3.0-only License | Accepted | 2026-10-07 |
| [ADR-017](ADR-017-stories-as-unit-of-work.md) | User Stories Are the Unit of Work | Accepted | 2026-10-07 |
| [ADR-018](ADR-018-deployment-architecture.md) | Deployment Architecture: Self-Hostable, K8s-Ready, SaaS-Later | Accepted | 2026-10-07 |
| [ADR-019](ADR-019-privacy-under-saas.md) | Privacy Under SaaS: No Tracking, Anywhere | Accepted | 2026-10-07 |
| [ADR-020](ADR-020-docs-by-role.md) | Documentation by Role: Use / Host / Build | Accepted | 2026-10-07 |
| [ADR-021](ADR-021-cli-only-automation.md) | Automation Surface: CLI Only, No MCP Server (supersedes ADR-014's MCP clause) | Accepted | 2026-10-07 |
| [ADR-022](ADR-022-wcag-2-1-aa.md) | WCAG 2.1 Level AA as the Accessibility Standard | Accepted | 2026-10-09 |
| [ADR-023](ADR-023-first-party-i18n.md) | First-Party i18n Adapter with JSON Locale Files | Accepted | 2026-10-09 |
| [ADR-024](ADR-024-one-asserted-api-suite.md) | One Asserted API Suite (Playwright) with a Served Explorer | Accepted | 2026-10-10 |

## Creating a New ADR

1. Copy the template: `ADR-000-template.md`
2. Fill in: Context, Decision, Rationale, Consequences
3. Add to the index above
4. Submit with your PR for review