# Import

You can bring data into Erledigen two ways. Open **Settings -> Import**,
pick a source, choose a file, and confirm:

- **Erledigen backup (JSON)** -- RESTORE: replaces EVERYTHING on this
  instance with the backup's contents (tasks including the trash,
  Someday groups, projects, habits, and your settings). A restore asks
  for confirmation first, and the server writes a safety backup next to
  the database before it wipes anything, so even a mistaken restore is
  itself restorable.
- **Generic task CSV**, **iCal (.ics)**, **Todoist CSV export**, and
  **Things 3 JSON export** -- IMPORT: every row becomes a NEW task.
  Existing data is never touched; run an import as many times as you
  like (each run adds the file's tasks again).

Notes:

- For the generic CSV, a column-mapping view appears after you pick the
  file: each Erledigen field (text, notes, date, tags, completed,
  priority, start time, end time) gets a dropdown of your file's
  columns. Columns are auto-detected from common header names, and an
  Erledigen CSV export re-imports without any changes.
- Rows the source marks canceled or deleted land in the **trash**, not
  in your lists -- restorable, never lost. Rows with unparseable dates
  import undated (to Someday) and the summary tells you.
- The summary after an import lists how many tasks were created (or
  restored) and any per-row warnings.
- The API accepts the same documents for scripts:

```sh
curl --data-binary @backup.json \
  "http://localhost:4000/api/import?format=json"
```

Formats are `json` (restore), `csv`, `ics`, `todoist-csv`, and
`things-json`. The body is the raw file content. For the generic CSV
you can pass an explicit column mapping as `field:columnIndex` pairs:

```sh
curl --data-binary @tasks.csv \
  "http://localhost:4000/api/import?format=csv&mapping=text:0,date:2"
```

Mapped fields are `text`, `notes`, `date`, `tags`, `completed`,
`priority`, `startTime`, and `endTime` (omitted fields import as
empty).

Source-specific mappings:

- **Todoist CSV**: export a project in Todoist (Settings ->
  Export project as CSV template). `@labels` become tags, priority
  1-4 map to `p1`/`p2`/`p3` (highest to lowest), sub-tasks keep their
  nesting, and note rows attach to their tasks. Recurring or relative
  due dates ("every Monday", "in 5 days") import undated -- move them
  to a habit schedule or a date after importing.
- **Things 3**: export with
  [things-cli](https://github.com/thingsapi/things-cli)
  (`things-cli --json all > things.json`). Checklists become
  sub-tasks, reminders become start times, and the deadline is kept in
  the task's notes. Projects and headings do not import (they are a
  different kind of collection in Erledigen).
- **iCal (.ics)**: VEVENT entries from Google Calendar, Apple
  Calendar, or Outlook exports import as tasks: timed events carry
  their start and end time, all-day events import date-only, and
  categories become tags. Recurring events import only their first
  occurrence. VTODO entries are skipped.

## Restoring

A restore is deliberately **replace, not merge**: the backup becomes
the instance's entire data set. If you restore an older backup, changes
made since that backup are gone (that is what restoring means). To
combine two instances, import the data you want to keep into a fresh
export instead, or use the pre-restore backup the server wrote for you.