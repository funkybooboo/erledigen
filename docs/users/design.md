# Product Design

This document describes the full product vision and design of Erledigen -- the layout, data model, key features, and architectural decisions that define what it is and how it works.

---

## Core Philosophy

Erledigen is a unified task management system built around one simple idea: **you should only need one place to manage your work and your life**.

The daily list is the execution surface. Someday is the capture net. Projects and habits feed into the daily list automatically. Everything is organized with tags -- the same tag system works across tasks, groups, Someday, and filters.

**Key principles:**
- One task type that appears differently depending on its attributes and context
- Tags as the primary organizational paradigm (including priority: `#p1`, `#p2`, `#p3`)
- Project tasks and recurring tasks feed into the daily list automatically -- no manual re-entry
- Auto-rollover for incomplete tasks with "late" tracking
- Streak tracking for recurring habits
- A layout that gets out of your way: clean, calm, spacious, Basecamp-inspired
- **No AI in the UI** -- AI automation lives exclusively in the MCP server and CLI
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
|G |   o write tests       #p2               |  + add task  |
|? |  + add task   (every friday -> habit)    |              |
|  |                                          |  #school     |
|  |  March 31, Monday  -  2 tasks            |  ----------- |
|  |  -------------------------------------  |   o essay    |
|  |   o deploy to prod   #p1               |              |
|--+------------------------------------------+--------------|
|  erledigen   14:32   #work x  #p1 x    12 tasks - 4 done  ^ Today |
\------------------------------------------------------------/
```

Rail icons are abbreviated in the mockup above: M=Summary, P=Projects,
H=Habits, C=Calendar, S=Search, F=Filter, T=Trash, G=Settings, ?=Help.

Four zones:
- **Left icon rail** -- slim vertical rail; each icon opens a large centered modal (also via `g`-sequences: `g s` Summary, `g p` Projects, `g h` Habits, `g c` Calendar, `g f` Filter, `g x` Trash, `g o` Settings)
- **Center day list** -- the primary working area; a continuously-scrolling list of day sections with a month minimap on the left edge
- **Right Someday panel** -- always visible by default; collapsible (`Cmd/Ctrl+\\`) and drag-to-resize (width persisted)
- **Bottom bar** -- `erledigen logo (home/today) | live clock | filter chips | task count | ^ Today`

Every interactive element shows a hover tooltip with its keybinding (see the Help modal, `?`), and a trailing recurrence phrase in any add input ("every friday", "daily at 9am", ...) creates a habit.

---

## Unified Data Model

```typescript
interface Task {
  id: string
  text: string
  notes: string | null              // markdown
  completed: boolean
  date: string | null               // null = Someday / unscheduled
  startTime: string | null          // "09:00" -- null = all-day
  endTime: string | null            // "10:30" -- null = all-day or open-ended
  tags: string[]                    // #work, #p1, #build-erledigen, #deadline, etc.
  parentId: string | null           // nested sub-tasks
  rolloverEnabled: boolean          // per-task override; default: true
  someDayGroupId: string | null     // which Someday group

  projectId: string | null
  position: number | null
  state: 'ready' | 'scheduled' | 'done' | null

  recurringTaskId: string | null
  instanceDate: string | null

  originalScheduledDate: string | null
  daysLate: number
  dependsOn: string | null

  reminder: { time: string; channels: ('push' | 'email')[] } | null

  createdAt: string
  updatedAt: string
}

interface SomeDayGroup {
  id: string
  name: string
  description: string | null
  tag: string                    // required -- used for cross-app filtering
  position: number
  createdAt: string
}

interface Project {
  id: string
  name: string
  description: string | null
  startDate: string | null
  dueDate: string | null
  isActive: boolean
  createdAt: string
  completedAt: string | null
}

type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface RecurringTask {
  id: string
  text: string
  notes: string | null
  tags: string[]
  frequency: RecurringFrequency
  interval: number               // e.g. every 2 weeks -> frequency: 'weekly', interval: 2
  daysOfWeek: number[] | null   // 0-6 (0 = Sunday) the schedule lands on; covers "every weekday" ([1..5]) and "every weekend" ([0, 6]); null = any day
  dayOfMonth: number | null     // 1-31 for monthly recurrence
  startDate: string
  endDate: string | null
  rolloverEnabled: boolean
  startTime: string | null      // "09:00" -- stamped onto generated instances
  createdAt: string
  updatedAt: string
}

interface RecurringTaskStats {
  recurringTaskId: string
  currentStreak: number
  longestStreak: number
  totalCompletions: number
  lastCompletedDate: string | null
}

interface ActiveFilters {
  tags: string[]
  projectId: string | null
  priority: string | null
  showCompleted: boolean
}

// Single-row entity -- id is always 'default' in single-user mode
interface UserPreferences {
  id: 'default'
  theme: 'light' | 'dark' | 'system'
  locale: string                   // e.g. 'en', 'fr', 'es'
  someDayPanelWidth: number
  someDayPanelCollapsed: boolean
  rolloverEnabled: boolean
  showEmptyDays: boolean
  activeFilters: ActiveFilters
  updatedAt: string
}
```

---

## Extensibility: Interface Inventory

Every major subsystem has an interface in `packages/shared`. Adapters implement the interface. New implementations can be swapped in without changing application code.

The table below is the target inventory. Repository adapters (in-memory + SQLite) are implemented today; the rest are planned per the [roadmap](../../plans/roadmap.md).

| Interface | Status | Adapters |
|-----------|--------|----------|
| `TaskRepository` / `ProjectRepository` / `RecurringTaskRepository` / `SomeDayGroupRepository` / `UserPreferencesRepository` | **Implemented** | In-memory, SQLite (raw SQL, [ADR-001](../devs/architecture/decisions/ADR-001-sqlite-raw-sql-persistence.md)) |
| `HttpClient` / `Logger` / `DateProvider` / `ConfigProvider` | **Implemented** | Fetch, Console, NativeDate, env/Vite |
| `ExportAdapter` / `ImportAdapter` | Interface only | JSON, CSV, Markdown, iCal planned |
| `EmailAdapter` / `PaymentAdapter` / `I18nAdapter` / `NLPAdapter` / `RateLimiterAdapter` / `NotificationAdapter` | Planned | -- |

---

## Command Palette Convention

The command palette (Cmd/Ctrl+K, or `/`) has two modes:

- **Plain text** -> search across all tasks (text, notes, tags; substring match). Results scroll the day list to the matching task on selection, and arrow keys move the selection.
- **`/` prefix** -> command mode. `/add <text>` creates a task for today -- and a trailing recurrence phrase ("water plants every friday at 9am") creates a habit instead. The command registry in `SearchModal` is extensible; the full command set (`/go`, `/filter`, `/move`, ...) is planned for v0.5.0+ of the roadmap.

---

## Key Features

### Tag System
Tags are the primary organizational tool. A task can have any number of tags. Special tag conventions:
- `#p1`, `#p2`, `#p3` -- priority levels
- `#deadline` -- promoted in Summary modal
- `#project-name` -- links task visually to a project
- `#habit-name` -- useful for grouping recurring tasks

### Someday Panel
The right-side Someday panel captures ideas and unscheduled work. Tasks are organized into user-created groups (tag-based). Works identically to the day list but without dates or automation. Global filtering applies.

### Command Palette (Cmd/Ctrl+K)
One unified modal for search and commands. `/add fix auth #work #p1` creates a task for today (tags are parsed; a trailing recurrence phrase creates a habit); plain text searches tasks. The fastest way to do anything in Erledigen -- the command set grows from here (see the roadmap).

### Project Management
Projects are collections of ordered tasks with a detail view in the Projects modal. Activate/deactivate flips the project's `isActive` flag (auto-distribution of tasks across days between start and due dates is planned for v0.9.0). Project tasks appear in the day list tagged with the project's auto-generated `project:`-prefixed tag.

### Habit Tracking
Recurring tasks ("habits") are created from natural-language phrases -- type "water plants every friday at 9am" in any inline add input or the Habits modal and the schedule is parsed live. Instances are generated idempotently into the daily list (+90-day horizon) and tagged with the habit. Completing instances builds streaks (current, longest, total completions) shown as badges in the Habits modal. A GitHub-style completion heatmap is planned (v0.9.0).

### Rollover
Incomplete tasks roll over to the next day by default. The `daysLate` counter tracks how overdue a task is. Configurable app-wide and per-task. (Planned for v0.8.0 -- the per-task `rolloverEnabled` flag and Settings toggle exist today; automatic movement does not.)

### Calendar Modal
The Calendar rail icon opens a month-grid date picker: picking a date scrolls (and centers) the day list on it; **Today** is a full view reset (day list + month minimap). A time-grid view for tasks with `startTime`/`endTime` is planned for v0.14.0.

---

## Monorepo Structure

```
erledigen/
|-- packages/
|   |-- client/   # SvelteKit frontend (Tailwind CSS, Svelte 5 runes)
|   |-- server/   # Bun REST API + WebSocket server
|   \-- shared/   # Types, adapter interfaces, constants, universal utilities
|-- docs/         # User + developer docs; ADRs in docs/devs/architecture/decisions/
|-- tests/        # Playwright e2e + api suites, Bruno API collection
|-- plans/        # Roadmap and planning docs
\-- package.json
```

`packages/cli` (v2.0.0) and `packages/mcp` (v2.1.0) are planned but do not exist yet.

---

## Persistence Strategy

| Phase | Adapter | Status |
|-------|---------|--------|
| Development / tests | In-memory (`STORAGE_ADAPTER=memory`) | Implemented |
| Self-hosted v1 | SQLite (raw SQL via `bun:sqlite`, [ADR-001](../devs/architecture/decisions/ADR-001-sqlite-raw-sql-persistence.md)) | Implemented (default) |
| Multi-user v2 | PostgreSQL (raw SQL, same repository interfaces) | Planned v2.3.0 |

---

## Success Metrics

**For users:**
- Can replace their current task system with Erledigen
- Daily list is the primary interface (>80% of time spent there)
- Streak lengths increase over time
- Late task count decreases over time

**Technical:**
- >85% test coverage
- <100ms response time for day list
- Zero data loss incidents
- All E2E tests passing
- Biome checks passing
- axe-core a11y checks passing in CI
- Zero known-vulnerable dependencies in CI
