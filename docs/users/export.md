# Export

You can download your data at any time. Open **Settings -> Export** and
pick a format:

- **JSON (backup)** -- the complete backup: every task (including the
  trash), Someday groups, projects, habits, and your preferences. Use
  this to keep a copy of your data.
- **CSV** -- the task list as a spreadsheet. Import it into Excel,
  Numbers, or Google Sheets.
- **Markdown** -- the task list grouped by day as `- [ ] text #tags`
  lines, ready for any notes app.
- **iCal** -- dated tasks as calendar events. Subscribe to or import the
  file in Google Calendar, Apple Calendar, or Outlook.

Notes:

- The JSON export is the only format that contains everything. CSV,
  Markdown, and iCal are readable task views: they list your active
  (non-deleted) tasks.
- Files download as `erledigen-export-<date>.<ext>`, for example
  `erledigen-export-2026-09-07.json`.
- The API can serve the same documents directly, for scripts and cron
  jobs:

```sh
curl -o backup.json "http://localhost:4000/api/export?format=json"
```

Formats are `json` (the default), `csv`, `md`, and `ics`. For CSV you can
request a column subset:

```sh
curl "http://localhost:4000/api/export?format=csv&columns=text,date,tags"
```