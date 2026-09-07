# ADR-008: Stable Export Formats and the Canonical JSON Snapshot

**Status**: Accepted
**Date**: 2026-09-07

## Context

The v0.7.0 roadmap calls for data export in four formats: JSON, CSV,
Markdown, and iCal, with "the JSON export format documented and stable --
users can rely on it for backups." That promise needs a precise, reviewable
definition: which entities are included, what happens to soft-deleted
(trash) tasks, how the document is served, and what may change later
without breaking anyone's backups.

Two smaller questions ride along: where the `ExportAdapter`/`ImportAdapter`
interfaces live, and how an endpoint whose payload is a file fits an API
that otherwise wraps everything in an `{ data: ... }` envelope.

## Decision

1. **JSON is the canonical, lossless backup format.** `GET
   /api/export?format=json` returns an `ExportSnapshot`:

   - `format: 'erledigen-export'` -- a discriminator, so a stray file can
     be told apart from an export on sight.
   - `version: 1` -- a schema version.
   - `exportedAt` -- ISO 8601 UTC timestamp.
   - `tasks`, `someDayGroups`, `projects`, `recurringTasks`,
     `userPreferences` -- every entity, and `tasks` INCLUDES soft-deleted
     rows (the trash): a backup that loses the trash is not lossless.

2. **The stability commitment covers field names and types of the
   snapshot.** Additive changes (new optional fields) do not bump the
   version. Removing or retyping a field bumps `version` to 2, and the
   future import path must then accept every released version -- exports
   are written years before they are read.

3. **CSV, Markdown, and iCal are views, not backups.** They serialize the
   ACTIVE task list (trash excluded); Someday (dateless) tasks appear in
   Markdown's "Someday" section and are excluded from iCal (no calendar
   date). The CSV column set is a validated subset parameter; the
   `priority` column is derived from the p1/p2/p3 tag convention.

4. **The response is the raw document.** Unlike every other API route,
   `/api/export` does not wrap its payload in `{ data: ... }`: the body is
   the file, served with `Content-Disposition: attachment;
   filename="erledigen-export-<yyyy-mm-dd>.<ext>"` and a per-format
   `Content-Type` (`application/json`, `text/csv`, `text/markdown`,
   `text/calendar`). A backup that is also the API payload means
   `curl -o backup.json ...` produces a valid, importable document.

5. **Interfaces live in `@erledigen/shared`.** `ExportAdapter<T>` and
   `ImportAdapter<T>` follow the `MetricsAdapter` precedent: the port and
   its universal implementations are shared code, so the client (download
   naming) and server (serialization) draw on one source of truth
   (`EXPORT_FORMAT_META`). Import implementations (JSON restore, CSV,
   iCal, Todoist CSV, Things 3 JSON) are the next slice; the interface is
   defined now because ADR-008's export is only meaningful as one half of
   the export/import contract.

## Rationale

- Backups are written by today's code but restored by tomorrow's; the
  version field plus a narrow stability promise (names and types) is the
  minimum commitment that makes the file trustworthy.
- The trash is data. A user who restores an export and finds yesterday's
  deletions gone has lost data -- the roadmap's "lossless round-trip"
  means the snapshot must include soft-deleted rows.
- Keeping view formats non-lossless lets them stay simple: a CSV that
  modeled reminders and the trash would be a worse spreadsheet AND a
  worse backup.
- The raw-document response makes the endpoint curl-friendly in the same
  spirit as the content-negotiation design (v0.3.0): what you download is
  what you keep.

## Consequences

### Positive

- Users can rely on the JSON export for backups; the format is versioned
  and documented in `/openapi.json` (the `ExportSnapshot` schema).
- Format metadata (extensions, media types) is defined once in shared code
  and reused by adapters, the route, the client download, and the tests.

### Negative

- `/api/export` breaks the envelope convention; API consumers must treat
  it as a file endpoint. The OpenAPI description states this.
- View formats are lossy by design; users wanting completeness must use
  JSON.

### Mitigations

- The route's OpenAPI entry documents the raw body and the attachment
  headers; the error envelope on 400 is unchanged.
- The import slice (see roadmap v0.7.0 remainder) must parse version 1
  snapshots and re-derive view-format conventions from the same shared
  constants.