# Privacy

Erledigen does not track you. Not a little, not "anonymously", not
"just aggregated" -- not at all, in any deployment mode.

## The promise, plainly

- **No analytics.** No product analytics in the client or the server:
  no session recording, no funnels, no heatmaps, no A/B experiments.
- **No telemetry.** No usage reports, no error reporters phoning home,
  no third-party analytics or crash-reporting SDKs. None is ever added
  ([ADR-019](../build/architecture/decisions/ADR-019-privacy-under-saas.md)).
- **No tracking.** The app knows nothing about how you use it beyond
  what you store in your own database.

This holds whether you run Erledigen yourself or someone runs it for
you: the hosted shape carries the same rule as the self-hosted one.
Your tasks are yours; an operator runs the software, not a
surveillance layer.

## What does exist

Being honest about the edges:

- **Your data.** Everything you write -- tasks, notes, tags, settings
  -- lives in your own SQLite database ([Export](./export.md) at any
  time; [Import](./import.md) takes it anywhere). Live sync between
  your open windows is a direct WebSocket connection between your
  browser and your instance. Nothing else is in the loop.
- **Operational logs.** A running service writes structured logs with
  request IDs, and can expose infrastructure metrics (CPU, memory,
  request counts). These measure the machine, not the person; they
  contain no user behavior, and operators can turn the metrics
  endpoint off entirely (`METRICS_ENABLED=false`).

That is the whole inventory. There is no "we may share data with
trusted partners" section, because there are no partners and no data
to share.