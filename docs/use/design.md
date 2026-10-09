# Product Design

This document describes the full product vision and design of Erledigen -- the layout, data model, key features, and architectural decisions that define what it is and how it works.

---

## Core Philosophy

Erledigen is an **automated paper calendar**: a day list you write by hand,
plus an engine that fills in everything that recurs and never moves your
handwriting. One place to manage your work and your life -- no accounts,
no analytics, your data in your own database.

The daily list is the execution surface. The Someday panel is the capture
net. Habits generate their instances into the daily list automatically.
Everything is organized with tags -- the same tag system works across tasks,
groups, Someday, and filters.

**Key principles:**
- One task type that appears differently depending on its attributes and context
- Tags as the primary organizational paradigm (including priority: `#p1`, `#p2`, `#p3`)
- Habit templates generate their instances into the daily list -- no manual re-entry
- Auto-rollover for incomplete tasks with "late" tracking
- Streak tracking for recurring habits
- A layout that gets out of your way: clean, calm, spacious, Basecamp-inspired
- **No AI in the UI** -- AI automation, if it ever ships, lives outside the UI (the CLI, per ADR-021), never in it
- **Privacy first** -- no analytics, no telemetry, minimal user data stored

---

## Layout Overview

```
/--+------------------------------------------+--------------\
|M |                                          |  Someday   < |
|P |                                          |  + add group |
|H |                                          |              |
|C |  March 30, Sunday  -  4 tasks            |  #work       |
|S |  -------------------------------------  |  ----------- |
|F |   o 09:00 fix auth  #work  #p1          |   o idea     |
|T |   o unit tests                          |   o thing    |
|A |   o write tests       #p2               |  + add task  |
|G |  + add task   (every friday -> habit)    |              |
|  |                                          |  #school     |
|  |  March 31, Monday  -  2 tasks            |  ----------- |
|  |  -------------------------------------  |   o essay    |
|? |   o deploy to prod   #p1               |              |
|--+------------------------------------------+--------------|
|  erledigen   14:32   #work x  #p1 x    12 tasks - 4 done  ^ Today |
\------------------------------------------------------------/
```

Rail icons are abbreviated in the mockup above: M=Summary, P=Projects,
H=Habits, C=Calendar, S=Search, F=Filter, N=Notes, T=Trash, A=Theme,
G=Settings, ?=Help.

Four zones:
- **Left icon rail** -- slim vertical rail; each icon opens a large centered modal (also via `g`-sequences: `g s` Summary, `g p` Projects, `g h` Habits, `g c` Calendar, `g n` Notes, `g f` Filter, `g x` Trash, `g a` Theme, `g o` Settings)
- **Center day list** -- the primary working area; a continuously-scrolling list of day sections with a month minimap on the left edge
- **Right Someday panel** -- always visible by default; collapsible (`Cmd/Ctrl+\\`) and drag-to-resize (width persisted)
- **Bottom bar** -- `erledigen logo (home/today) | live clock | filter chips | task count | ^ Today`

Every interactive element shows a hover tooltip with its keybinding (see the Help modal, `?`), and a trailing recurrence phrase in any add input ("every friday", "daily at 9am", ...) creates a habit. Add text may also carry a natural-language date ("buy milk tomorrow", "team sync next monday", "file taxes march 15") and `#tags` -- both are extracted onto the task.

---

## The Data Model

Erledigen has one task type that appears differently depending on its
attributes; everything else hangs off it. The authoritative definitions
live in `packages/shared/src/types/` (the source of truth for client,
server, and API schemas alike) -- conceptually:

- **Task** -- `text`, optional markdown `notes`, `completed`, and a
  local `date` key (`null` = lives in Someday). Times (`startTime` /
  `endTime`), `tags`, a `parentId` for sub-tasks (completion rolls up to
  the parent), per-task `rolloverEnabled`, a Someday group assignment,
  and soft-delete bookkeeping for the trash.
- **Tags ARE the domain model** -- `#p1`/`#p2`/`#p3` are priority,
  `project:`-prefixed tags link tasks to projects, and any free-form tag
  organizes work. There is no separate priority or project field.
- **SomeDayGroup** -- a named, tag-based group in the Someday panel
  (name, description, tag, position).
- **Project** -- name, description, start/due dates, active flag. A
  project owns a `project:`-prefixed tag; its tasks are the tasks
  carrying that tag.
- **RecurringTask** -- a habit template parsed from natural language:
  frequency, interval, `daysOfWeek`/`dayOfMonth`, date window, and a
  `startTime` stamped onto generated instances. Stats (current/longest
  streak, total completions, completed-date history) are computed from
  the generated instances.
- **Holiday** -- a named calendar date (name, date, no recurrence rule;
  one row per named date). Rendered as day-list banners and importable
  from `.ics` calendars.
- **DayNote** -- one note per calendar date: the day's margin. Never a
  task, never scheduled; collapsed away when empty, and included in the
  JSON backup like everything else.
- **UserPreferences** -- a single row holding every setting: theme,
  accent scheme, panel widths and collapse states, rollover behavior,
  delete confirmation, tag kinds, active filters (tags, completion,
  sort mode, date range), and more.

---

## Key Features

### Tag System
Tags are the primary organizational tool. A task can have any number of tags. Special tag conventions:
- `#p1`, `#p2`, `#p3` -- priority levels
- `#deadline` -- promoted in Summary modal
- `project:`-prefixed tags -- link a task to its project
- Habit templates carry their own tags, stamped onto every generated instance

Every tag carries a color (auto-assigned when first used; `#p1`/`#p2`/`#p3`
use the logo's pill colors) so chips read at a glance on task rows, in the
Filter modal, and in the bottom bar. Settings manages tags in one screen:
rename, merge, recolor, and remove -- each applies to every task that
carries the tag.

### Someday Panel
The right-side Someday panel captures ideas and unscheduled work. Tasks are organized into user-created groups (tag-based). Works identically to the day list but without dates or automation. Global filtering applies.

### Command Palette (Cmd/Ctrl+K)
One unified modal for search and commands. Plain text searches tasks (text, notes, tags). `/add fix auth tomorrow #work #p1` creates a task for the parsed date with the hashtags as tags (a trailing recurrence phrase instead creates a habit); other commands: `/complete <text>`, `/delete <text>`, `/move <text> to <date>`, `/go <date>` (e.g. `/go next monday`), `/tag <text> with <tag>`, `/filter <tag>`, `/clear`, `/today`, `/someday <text>`, `/project`, `/habit`, `/settings`, `/help`.

### Project Management
Projects are collections of tasks linked by their `project:`-prefixed tag. The Projects modal's detail view is a Kanban board -- three columns mapped onto real task state: **Ready** (no date yet), **Scheduled** (has a date; the card shows and edits it inline), and **Done**. Drag cards between columns to unschedule, schedule, or complete the underlying task; drops into Scheduled land on the project's window-start date, adjustable inline afterwards.

**Auto-distribute** previews a spread of the unscheduled backlog across the days between the project's start and due dates (never in the past; dependencies within the project are respected -- a blocked task is scheduled after its blocker); confirm to apply. **Activate** flips the project's `isActive` flag and applies the same distribution in one step.

Cards carry a lock button for dependencies: pick the task it is blocked by (a red lock shows while the predecessor is incomplete; completing the blocker releases it), and the blocked task schedules after its blocker in every distribution.

### Notes
Notes are the margin of the calendar. Task titles, task notes, and each day's margin note are live markdown -- only the line under your cursor shows the raw syntax while everything else renders. Tasks carrying notes show a sticky-note marker on their row, and the Notes modal (`g n`) is a lens over every note in one place: day notes by date, each day's task notes beneath them, and undated task notes at the end. Notes never exist standalone -- they always belong to a day or a task.

### Habit Tracking
Recurring tasks ("habits") are created from natural-language phrases -- type "water plants every friday at 9am" in any inline add input or the Habits modal and the schedule is parsed live. Instances are generated idempotently into the daily list (+90-day horizon) and tagged with the habit. Completing instances builds streaks (current, longest, total completions) shown as badges in the Habits modal, and the habit detail view shows a GitHub-style completion heatmap. Any existing task can be promoted to a habit with the "Make recurring" toggle in the task detail modal.

### Holidays
Settings > Holidays manages named calendar dates: add one by name and date, import a holiday `.ics` calendar by URL or file (duplicates are skipped, so re-importing a feed adds nothing), and delete ones you do not want. Each date renders a small banner above that day's section in the day list. Holidays are part of the JSON backup/restore (ADR-008/ADR-009).

### Rollover
Incomplete tasks roll over to the next day by default, on a schedule configurable app-wide (midnight / 9am / manual) and per task (`rolloverEnabled`). The `daysLate` counter tracks how overdue a task is, counted from the date it was first planned.

### Calendar Modal
The Calendar rail icon opens a month-grid date picker: picking a date scrolls (and centers) the day list on it; **Today** is a full view reset (day list + month minimap). A time-grid view for tasks with `startTime`/`endTime` is deferred -- see the [roadmap](../../plans/roadmap.md).

### Theming & customization
The Theme rail icon owns the look: light/dark/system, accent schemes drawn
from the logo's colors, text size, row spacing, and the completion flash.
Settings owns the behavior: empty-day visibility, whether filters survive a
restart, tag management, and full keyboard-shortcut remapping (click a
binding, press keys; clashes are warned). Your OS's reduced-motion setting
stills every animation, whatever the app preferences say.

---
