# Roadmap

This document outlines the development roadmap for Erledigen. We use semantic versioning to define chunks of work and track our progress.

---

## Where we stand (2026-10-04)

- **Package version tracks the roadmap** (decision, 2026-09-07):
  `package.json` carries the LAST SHIPPED roadmap milestone -- 0.9.0
  since the `v0.9.0` release (2026-10-04, the repo's first tagged
  release); interim PRs (branding, code cleanup) do not bump it. Cut
  the next release with `mise run release`, which bumps every
  manifest, bun.lock, and the runtime `version.ts` stamp together.
- **Shipped complete:** v0.1.0, v0.2.0, v0.3.0, v0.4.0, v0.4.1, v0.5.0,
  v0.6.0, v0.7.0, v0.8.0, v0.9.0, v0.10.0.
- **Shipped with v0.10.0 (2026-10-04):** live markdown everywhere
  (safe-by-construction renderer, ADR-015 -- not marked+DOMPurify),
  task-note + day-note + title live editing, day notes as the
  calendar's margin (new DayNote entity, one per date), the Notes
  modal lens on the icon rail (`g n`), the has-notes row indicator.
  Bundle budget 624 -> 664 KiB (the whole live-markdown system).
- **Shipped with v0.9.0 (2026-10-04, released as tag `v0.9.0`):**
  holidays (Settings manager + `.ics` import + day-list banners,
  PR #34), the Summary modal's overdue/streak/next-14-days sections
  (PR #35), and the project Kanban board (PR #36 -- since superseded
  by the v0.16.0 umbrella design).
- **Partial:** v0.11.0 (design system, theme system, delete behavior
  shipped), v0.12.0 (ARIA, focus management, skip link shipped).
- **The queue (2026-10-04 restructure -- numeric order, polish
  last):**
    1. **v0.11.0 / v0.12.0 remainders:** the Theme modal + accents +
       tag colors + Settings preferences (v0.11.0); accessibility
       (v0.12.0).
    2. **v0.13.0 -- i18n.**
    3. **v0.16.0 -- Projects as umbrellas + Someday tabs/lists**
       (designed 2026-10-04).
    4. **v0.17.0 -- Routines** (designed 2026-10-04).
    5. **v0.18.0 -- Gold-standard polish:** the UX-audit remainder
       (renumbered from v0.15.0 so polish runs on final surfaces,
       after the rebuilds).
    6. **v1.0.0 -- Public release.**
- **Deferred:** v0.14.0 (calendar time-grid -- see its section).
- **UX audit (2026-10-03, extended same day):** twenty-seven findings
  from a self-review of the shipped app (raw notes in
  [issues.md](issues.md)) ship with their home versions: the polish
  remainder in v0.18.0, the habits findings in v0.17.0, the Someday
  redesign in v0.16.0, live markdown + the notes indicator in
  v0.10.0, the Theme modal + logo coloring in v0.11.0. Two shipped
  decisions were reversed: the `/` command palette is REMOVED
  (plain `{mod}+K` search and every keyboard shortcut stay -- see
  the v0.5.0 note), and drag-and-drop was REACTIVATED (shipped with
  v0.6.0).

Features have shipped out of release order throughout v0.x (SQLite and
recurring tasks are the big ones). **Policy decision (2026-10-03): go
in numeric order -- always complete the lowest version that is not
complete before starting anything higher.** (2026-10-04: one
deliberate exception -- the v0.15.0 polish pass renumbered to
v0.18.0 so it runs after the v0.16.0/v0.17.0 structural rebuilds;
polish last.) A same-day codebase audit verified every
shipped-complete claim against the tree and fixed stale checkboxes
in place. (One audit correction -- the claim that Bruno tests never
shipped -- was itself wrong and is reverted in the v0.3.0 section;
the collection is real: `tests/api/`, dockerized via `mise run
test-api`.)

**System rules (2026-10-04, whole-app coherence pass).** The product
identity, in one sentence: Erledigen is an **automated paper
calendar** -- a day list you write by hand, plus an engine that fills
in everything that recurs and never moves your handwriting. Recorded
as [ADR-010](../docs/devs/architecture/decisions/ADR-010-automated-paper-calendar.md);
the adjacent-concept verdicts (no time grid, people as tags, no docs
subsystem, modals as lenses) are
[ADR-014](../docs/devs/architecture/decisions/ADR-014-scope-boundaries.md).
Every feature obeys these rules:

1. One home per task -- a day or a someday list, never a modal.
2. The date is the only bridge between the two worlds.
3. One grammar in every input: text first, then qualifiers (`#tags`,
   a date phrase, a routine phrase, times).
4. Typed words and manual controls can never disagree.
5. Arrivals are placed once (routine order, time, or the bottom);
   after that, manual order is sovereign -- nothing reorders
   continuously, and continuous sort modes do not exist.
6. In-day sections are tasks whose text is a heading ("# Morning").
7. Tags are the only join key: priority, project, routine, or
   free-form -- someday lists carry no tags of their own.
8. Umbrellas read, never move: projects, holidays, stats, and the
   notes view are lenses over work that lives on days or in lists.
9. Routine instances are real tasks; generation is idempotent and
   history is immutable -- schedule edits reshape the future only.
10. One noun per concept, used everywhere.
11. Automation never rewrites handwriting: it materializes, places
    arrivals, and derives displays -- nothing else.

---

## v0.1.0: Foundations

This release focuses on establishing the project's foundation, including the core architecture, development environment, and documentation.

- [x] **Monorepo Setup:** Set up a monorepo with `bun` to manage the `client`, `server`, and `shared` packages.
- [x] **Tech Stack:**
    - Frontend: Svelte with SvelteKit
    - Backend: Bun
    - Language: TypeScript
- [x] **Architecture:** Implement a clean, modular architecture using the Adapter Pattern.
- [x] **Code Quality:** Configure Biome for formatting and linting.
- [x] **API:**
    - Setup basic CRUD endpoints for tasks.
    - Use Bun's built-in HTTP server.
- [x] **Client:**
    - Setup basic client with a simple UI to display tasks.
- [x] **Documentation:**
    - Create comprehensive documentation for architecture, code standards, testing, and more.
- [x] **Testing:**
    - Setup Playwright for E2E testing.
    - Setup Bruno for API testing.

---

## v0.2.0: Core Task Model

This release defines the full data model that powers the entire application -- tasks, sub-tasks, Someday groups, projects, and recurring tasks.

- [x] **Task Model:** Define the complete `Task` type in `packages/shared` with all fields:
    - `id`, `text`, `notes` (markdown), `completed`, `date` (`null` = Someday), `createdAt`, `updatedAt`
    - `tags: string[]` -- first-class tag system; priority is expressed as special tags (`#p1`, `#p2`, `#p3`); projects use `project:` prefix tags
    - `parentId: string | null` -- enables nested sub-tasks
    - `rolloverEnabled: boolean` -- per-task rollover override (default: `true`)
    - `someDayGroupId: string | null` -- which Someday group this task belongs to
    - `position: number | null`, `state: 'ready' | 'scheduled' | 'done' | null`
    - `recurringTaskId: string | null`, `instanceDate: string | null`
    - `originalScheduledDate: string | null`, `daysLate: number`
    - `dependsOn: string | null`
    - `startTime: string | null` -- ISO 8601 time string (e.g. `"09:00"`); `null` = all-day task
    - `endTime: string | null` -- ISO 8601 time string; `null` = all-day or open-ended
    - `reminder: { time: string; channels: ('push' | 'email')[] } | null` -- stub field; implemented in v2.2.0
- [x] **SomeDayGroup Model:** Define `SomeDayGroup` -- user-created tag-based groups in the Someday panel (`id`, `name`, `description: string | null`, `tag`, `position`, `createdAt`).
- [x] **Project Model:** Define `Project` (`id`, `name`, `description`, `startDate`, `dueDate`, `isActive`, `createdAt`, `completedAt`).
- [x] **RecurringTask Model:** Define `RecurringTask` template and `RecurringTaskStats` (`currentStreak`, `longestStreak`, `totalCompletions`, `lastCompletedDate`).
- [x] **UserPreferences Model:** Define `UserPreferences` entity -- stores all user-configurable settings and UI state (panel widths, scroll position, active filters, theme, locale, etc.). Single-row entity for single-user mode; per-user in multi-user mode.
- [x] **Task CRUD:** Implement Create, Read, Update, Delete in memory. All operations tested with unit tests (written before implementation).
- [x] **Tag System:** Tags are plain strings stored on tasks. No separate Tag entity needed -- tags are derived from task data.
- [x] **Someday Support:** Tasks with `date: null` are unscheduled. `someDayGroupId` assigns them to a group.
- [x] **Sub-task Support:** Tasks with `parentId` are sub-tasks. Completion of all sub-tasks rolls up to parent.

### Technical Notes & Considerations

- All models live in `packages/shared` to be used by client, server, CLI, and MCP packages.
- Priority (`#p1`, `#p2`, `#p3`) is a tag convention defined by `DEFAULT_TAG_KINDS` -- no separate priority field. Projects use `project:` prefix tags.
- The `tags` array is the primary organizational system across the entire app.
- `rolloverEnabled` defaults to `true` app-wide; the per-task field overrides the app setting.
- `startTime`/`endTime` are stored as time-only strings tied to the task's `date`. All-day tasks have both as `null`.
- The `reminder` field is defined here for type stability but the delivery infrastructure ships in v2.2.0.

### Documentation & ADRs

- ADR: tag-based priority convention vs. a dedicated priority field.
- ADR: why `startTime`/`endTime` are stored as time strings (not full timestamps).

### Definition of Done

- [x] All models fully defined and exported from `packages/shared`.
- [x] Full CRUD for tasks with unit tests (written first).
- [x] Sub-task parent/child relationship tested.
- [x] Someday group assignment tested.
- [x] Tag filtering logic tested (filter tasks by one or more tags).
- [x] `startTime`/`endTime` validation tested (must be valid time strings or null; `endTime` >= `startTime`).

---

## v0.3.0: API Endpoints

This release creates the REST API for all entities. The API is designed to be clean, well-documented, and accessible from both browsers and the command line (curl-friendly).

- [x] **Schema-first OpenAPI:** Zod schemas in `packages/server/src/openapi/schemas/` are the single source of truth. The OpenAPI 3.1 spec is generated at startup via `@asteasolutions/zod-to-openapi` and served at `/openapi.yaml` and `/openapi.json`. All request validation in route handlers uses the same schemas -- no duplication.
- [x] **Task API:** Full CRUD endpoints for tasks, including filtering by date, tag, completion status, and Someday group.
- [x] **SomeDayGroup API:** CRUD endpoints for managing Someday groups.
- [x] **Project API:** CRUD endpoints for projects, plus activate/deactivate.
- [x] **RecurringTask API:** CRUD for recurring task templates; endpoint to generate instances for a date range.
- [x] **Tag API:** Derive tags from task data; endpoint to list all tags, rename, merge.
- [x] **UserPreferences API:** GET and PATCH endpoints for reading and updating user preferences.
- [x] **Content negotiation (curl-friendly):** All endpoints inspect the `Accept` header:
    - `application/json` (or no header from a browser) -> JSON response (default)
    - `text/plain` or absent `Accept` (curl default) -> human-readable plain text response
    - Example: `GET /tasks/today` with `Accept: text/plain` returns a plain-text task list
- [x] **Security headers:** All responses include:
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY`
    - `Content-Security-Policy` (strict baseline; tightened in v2.4.0)
    - `Strict-Transport-Security` (HSTS; enforced in production)
- [x] **Rate limiting:** Simple token-bucket rate limiter on all endpoints from day one. Configurable via environment variable.
- [x] **Input validation:** Zod validators on all request bodies and query params, generated from the OpenAPI spec.
- [x] **Export/Import adapter interfaces:** Define `ExportAdapter<T>` and `ImportAdapter<T>` interfaces in `packages/shared`. Implemented in v0.7.0.

### Technical Notes & Considerations

- RESTful design throughout. Consistent error response shape: `{ error: string; code: string; details?: unknown }`.
- Bruno tests written before implementation (TDD). Every endpoint has a Bruno test file -- the collection in `tests/api/` (~90 `.bru` files) runs dockerized via `mise run test-api`; the Playwright `api` project in `tests/api-tests/` is the asserted automated suite over the same surface. (Correction 2026-10-03: an earlier same-day edit wrongly claimed the Bruno tooling never shipped.)
- The OpenAPI spec is auto-served at `GET /openapi.yaml` and `GET /openapi.json`.
- Content negotiation uses the `accepts` library or equivalent.
- Rate limiting state lives in-memory for single-user; Redis-backed in v2 for multi-user scale.

### Documentation & ADRs

- ADR: schema-first OpenAPI approach (spec -> validators -> implementation).
- ADR: content negotiation strategy (curl-friendly plain text).
- Dev docs: API reference auto-generated from the OpenAPI spec.

### Security Considerations

- All inputs validated and sanitized at the API boundary.
- Security headers applied globally via middleware.
- Rate limiting prevents abuse even in single-user mode.

### Definition of Done

- [x] All endpoints implemented and tested with Bruno (tests written first).
- [x] OpenAPI spec complete and served at `/openapi.yaml`.
- [x] Zod validation on all inputs.
- [x] Content negotiation working: JSON and plain-text responses for all list endpoints.
- [x] Security headers present on all responses.
- [x] Rate limiting functional.

---

## v0.4.0: Basic UI

This release builds the core three-panel layout and all fundamental task interactions.

### Layout Shell

- [x] **Four-zone layout:**
    - **Left icon rail** -- slim vertical rail with icons that each open a large centered modal (background dims on open, `Esc` or click-outside closes). One modal open at a time.
    - **Center day list** -- the primary working area; fills all space between the two panels.
    - **Right Someday panel** -- collapsible via toggle button or `Ctrl+\`; width saved to `UserPreferences`. *(Resizable drag handle -> v0.6.0)*
    - **Bottom bar** -- state display and navigation (see Bottom Bar section below).

- [x] **Active icon highlight:** The active modal's icon has a subtle highlight in the icon rail.
- [x] **Icon labels:** Shown/hidden via Settings.

### Bottom Bar

Layout: `erledigen logo | filter chips | task count | ^ Today | docs ->`

- [x] **Left:** `erledigen` logo -- clicking clears all filters and snaps to today (home button).
- [x] **Center-left:** active filter chips, each with `x` to dismiss; `[clear all]` when multiple filters active.
- [x] **Center-right:** status -- `12 tasks - 4 done`; when no filters: `March 30 - 12 tasks`. (The 2026-10-03 audit removes the store-wide counter readout -- see v0.15.0.)
- [x] **Right:** `^ Today` button -- visible only when today section is out of viewport. IntersectionObserver wires `todayVisible` in DayList.svelte
- [x] **Far-right:** `docs ->` link -- opens the Writebook user docs in a new tab. (Lost in the frontend simplification; the 2026-10-03 audit asks for it back -- see v0.15.0.)

### Day List

- [x] **Day section header:** Date label + task count + completed count.
- [x] **Task row:** Drag handle (grip) on left (visible on hover), checkbox, text, tag chips, time display for tasks with `startTime`.
- [x] **Recurring task indicator:** Subtle recurrence icon after the task text.
- [x] **Sub-tasks:** Child tasks with `parentId` rendered indented below their parent task.
- [x] **Empty days:** Render empty day sections between today +/-30 days when `showEmptyDays` preference is enabled.
- [x] **App opens scrolled to today** with a subtle "Today" highlight. `scrollToToday()` called on mount.
- [x] **`+ add task`** prompt at the bottom of each day section.

### Task Interactions

- [x] **Click text** -> inline edit (Enter saves, Esc cancels).
- [x] **`e` or detail icon** -> floating task detail modal (text, notes, tags, date picker, `startTime`/`endTime` fields, rollover toggle).
- [x] **Space** -> complete task; undo toast (5s) + Cmd+Z.
- [x] **`d`** -> delete task; undo toast (5s) + Cmd+Z. Behavior (instant vs confirm) configurable in Settings -- respects `deleteConfirmation` preference.
- [x] **`n` or `a`** -> inline add input appears at bottom of focused day section.
- [x] **Drag (grip handle)** -> drag between day sections; drag right to Someday (clears date); drag left from Someday onto a day header to schedule.

### Someday Panel

- [x] Title "Someday" with collapse button (<).
- [x] `+ add group` button at top.
- [x] Groups rendered with same task rows and interactions as day sections.
- [x] Ungrouped tasks rendered below groups.
- [x] Global filter applies to Someday tasks simultaneously with the day list (via shared `applyFilters` utility).
- [x] Group creation uses inline form instead of browser `prompt()`.
- [x] Group rename and delete actions.

### Icon Rail Modals

- [x] **Calendar** -- date picker to jump the day list to any date. Functional.
- [x] **Trash** -- recently deleted tasks with restore; auto-purge after 7 days. Functional.
- [x] **Help** -- keyboard shortcut reference organized by category. Functional.

- [x] **Summary** -- daily stats: completion percentage, overdue tasks (with days-late count), upcoming deadlines (tasks tagged `#deadline`).
- [x] **Projects** -- project list view (active and inactive) with task counts, + new project inline form, edit/delete actions, and detail view showing project tasks.
- [x] **Habits** -- recurring task list view (name, frequency label, tags, dates) with instance count badges, + new habit inline form, and edit/delete actions.
- [x] **Search** -- search tasks by text, notes, and tags; selecting a result scrolls the day list to that task.
- [x] **Filter** -- filter by tags using dynamic `tagKinds` sections (single-behavior kinds render as radio groups, multiple as toggle chips), plus completion status toggle.
- [x] **Settings** -- theme (light/dark/system), auto-rollover toggle, show empty days toggle, panel toggle hint, delete confirmation toggle (instant vs confirm).

### TaskDetailModal

- [x] **Text field** -- editable task text.
- [x] **Notes field** -- editable markdown notes.
- [x] **Date picker** -- set or clear the task date.
- [x] **Start time / End time** -- time inputs for scheduled tasks.
- [x] **Tags field** -- comma-separated tag input.
- [x] **Rollover toggle** -- per-task auto-rollover override.
- [x] **Parent task reference** -- read-only display when viewing a sub-task.
- [x] **Recurring task reference** -- read-only indicator when viewing a recurring instance.
- [x] **Sub-task management** -- add, complete, and delete child tasks from within the detail modal.
- [x] **Delete task** -- delete button in the modal with undo toast.

### Technical Notes & Considerations

- Built with SvelteKit + Tailwind CSS v4.
- **Svelte 5 runes:** All stores use `$state` class pattern in `.svelte.ts` files. All components use `$props`, `$derived`, `$effect`, `{@render children()}`.
- **Escape key handling:** `svelte:window` in layout handles global escape; Modal stops propagation only for Tab (focus trap).
- Optimistic updates for all task mutations.
- ARIA roles and labels applied to all interactive elements from the start -- not retrofitted later.
- E2E tests use `data-hydrated` attribute for reliable SvelteKit hydration detection.
- Storybook stories exist for all 20 components (10 top-level + 10 modals).

### Documentation & ADRs

- User docs: "Getting started" and "Using the day list" written for this release.
- ADR: bottom bar layout and docs link placement.

### Definition of Done

- [x] All four zones render correctly.
- [x] Bottom bar reflects filter and task state; docs link present and working.
- [x] Calendar, Trash, Help modals functional.
- [x] Search, Filter, Settings modals have basic functionality.
- [x] Storybook stories for all components (20 story files exist; need build verification).
- [x] Full task CRUD through the UI, including sub-task create/complete/delete in the detail modal (the old "missing" caveat was stale -- verified 2026-10-03).
- [x] Sub-tasks rendered indented below parent tasks in day list.
- [x] TaskDetailModal: sub-task add/complete/delete and task delete button.
- [x] Empty days render when preference is enabled.
- [x] IntersectionObserver wires `todayVisible` for the ^ Today button.
- [x] Someday panel: inline group creation form; group rename/delete.
- [x] Summary, Projects, Habits modals: functional list views (streaks -> v0.8.0, Kanban/heatmaps -> v0.9.0).

---

## v0.4.1: Architecture Clean-Up

Refactoring pass to fix API mismatches, extract shared types/constants/utilities, add server service layer, WebSocket real-time sync, flexible tag system, and clean up client architecture.

### Client/Server API Bug Fixes
- [x] Fix `tagService.getAll()` -- wrong response type shape (`{data: {tags: string[]}}` -> `ApiResponse<string[]>`)
- [x] Fix `tagService.rename()` -- wrong HTTP method (PUT->POST), wrong body fields (`{oldName,newName}`->`{from,to}`), wrong response type
- [x] Fix `tagService.merge()` -- wrong HTTP method (PUT->POST), wrong body shape (`{sourceTag,targetTag}`->`{sources:string[],target}`), wrong response type
- [x] Fix `projectService.activate()`/`deactivate()` -- wrong HTTP method (PUT->POST)
- [x] Fix `tagStore` -- re-fetch tags after rename/merge instead of using stale return value

### Shared Package -- Types, Constants, Utilities
- [x] Add `ErrorResponseBody`, `TaskQueryParams`, `RenameTagRequest/Response`, `MergeTagRequest/Response` to `shared/types/api.ts`
- [x] Add `ThemeType`, `DeleteConfirmationType`, `NotificationPosition`, `TagKind`, `TagKindBehavior` to `shared/types/userPreferences.ts`
- [x] Add `USER_PREFERENCES_DEFAULTS`, `TASK_DEFAULTS`, `RECURRING_TASK_DEFAULTS`, `PURGE_RETENTION_DAYS`, `DEFAULT_DAY_RANGE`, `DEFAULT_TOAST_DURATION_MS`, `DEFAULT_RATE_LIMIT_RPM`, `DEFAULT_TAG_KINDS`, `DEFAULT_TAG_KIND_MAP`, `SOMEDAY_KEY`, weekday/month name constants, `CONTENT_TYPE_TEXT`, `MAX_SEARCH_RESULTS`, route patterns to `shared/constants.ts`
- [x] Add `RateLimitError`, `createNotFoundError`, `createValidationError` to shared errors
- [x] Create `shared/utils/` with `resolveTagKind`, `getTagsByKind`, `getKindValues`, `parseTags`, `formatTags`, `slugify`, `groupTasksByDate`, `isOverdue`, `hasDeadlineTag`, `formatFrequency`
- [x] Delete `server/adapters/data/defaults.ts` -- replaced by shared constants
- [x] Fix `preferencesStore` -- remove local `ActiveFilters` type, use `ThemeType`/`DeleteConfirmationType`/`NotificationPosition` from shared, use `USER_PREFERENCES_DEFAULTS`
- [x] Fix `filters.ts` -- replace local `FilterState` with `ActiveFilters` from shared; filter by tags only (no separate `projectId`/`priority` fields)

### Flexible Tag System
- [x] Add `TagKind` type (`id`, `name`, `behavior`, `prefix`, `sortOrder`, `color`) to `shared/types/userPreferences.ts`
- [x] Add `tagKinds: TagKind[]` and `tagKindMap: Record<string, string>` to `UserPreferences`
- [x] Add `DEFAULT_TAG_KINDS` (priority: single, project: single with `project:` prefix) and `DEFAULT_TAG_KIND_MAP` (`p1/p2/p3` -> `priority`) to `shared/constants.ts`
- [x] Add `resolveTagKind()`, `getTagsByKind()`, `getKindValues()` utilities to `shared/utils/tagKinds.ts`
- [x] Add `NotificationPosition` type and `notificationPosition` preference
- [x] Rewrite `FilterModal` to dynamically render sections from `tagKinds` -- single-behavior kinds as radio groups, multiple as toggle chips
- [x] Remove `projectId` and `priority` from `ActiveFilters` -- projects and priorities are now just tags, filtered via `tags[]`
- [x] Remove `setProject()`/`setPriority()` from `preferencesStore` -- `toggleTag()`/`setTags()` handle all filtering
- [x] Remove `Task.projectId` and `RecurringTask.projectId` -- project linkage is via `project:` prefix tags
- [x] Remove `PRIORITY_TAGS` constant and `isPriorityTag()` -- replaced by `DEFAULT_TAG_KINDS`/`DEFAULT_TAG_KIND_MAP` and `resolveTagKind()`
- [x] Update `BottomBar` to render all active filters as uniform tag chips (no separate project/priority chips)
- [x] Update server Zod schemas to match: `ActiveFiltersSchema` uses `tags[]` + `showCompleted`, no `projectId`/`priority`; task schemas have no `projectId`

### Collapsible Sections & Panel Persistence
- [x] Create shared `SectionHeader` component with collapsible chevron, task stats, overdue indicator, and today highlight
- [x] Add `collapsedSections: string[]` to `UserPreferences` with `isSectionCollapsed()`/`toggleSectionCollapsed()` in `preferencesStore`
- [x] Add `someDayPanelLastOpenWidth` to `UserPreferences` to persist panel width across refreshes
- [x] Day sections show overdue count with red left border; Someday groups use unified `SectionHeader` pattern
- [x] Smooth 200ms panel toggle animation

### Notification System
- [x] Add `notificationStore` (Svelte 5 `$state` class) with push, dismiss, clear, auto-dismiss, and action buttons
- [x] Add `NotificationContainer` component with enter/leave animations and configurable position (`notificationPosition` preference)
- [x] Connection status notifications (connected, disconnected, reconnecting, synced, error) via `connectionStore`

### WebSocket Real-Time Sync
- [x] Add `ConnectionManager` on server -- tracks connected clients with connect/disconnect/message callbacks
- [x] Add `BunWebSocketServer` implementing `WebSocketServer` interface -- broadcast and send methods
- [x] Add `WebSocketManager` service -- subscribes to `EventBus.onAny()` and rebroadcasts all events via WebSocket
- [x] Add `EventBus` service on server -- `emit()`, `onAny()`, `on()` for domain event publishing
- [x] Add WebSocket types to `shared/types/websocket.ts` -- `WsServerMessage` discriminated union with event types for task, project, someday group, and recurring task CRUD
- [x] Add `connectionStore` on client -- manages `WebSocketService` lifecycle, connection state, and client ID header
- [x] Wire WebSocket into server container and `index.ts` -- `listen()` upgrades start WebSocket server; domain events broadcast to connected clients

### Server Service Layer
- [x] Create `server/services/TaskService.ts` -- listTasks, completeTask, getTrash, purge
- [x] Create `server/services/TagService.ts` -- listTags, renameTag, mergeTags
- [x] Create `server/services/RecurringTaskService.ts` -- generateInstances
- [x] Create `server/services/ProjectService.ts` -- listProjects
- [x] Wire services into Container
- [x] Add `respondNegotiated()` helper to `routeHelpers.ts`
- [x] Refactor all route files to thin HTTP adapters calling services
- [x] Move query Zod schemas from route files to `openapi/schemas/`
- [x] Move `formatters.ts` to `server/presentation/formatters.ts`

### Client Architecture Clean-Up
- [x] Merge `filterStore` into `preferencesStore` -- toggleTag, clearAll, setTags, setShowCompleted, activeFilterCount getter
- [x] Add `getTrash()`, `softDelete()`, `restoreFromTrash()`, `purge()` to `taskStore`
- [x] Update `TrashModal` to use `taskStore` instead of direct `TaskService`
- [x] Replace inline types in stores with shared input types (`CreateRecurringTaskInput`, `CreateProjectInput`, `CreateSomeDayGroupInput`, etc.)
- [x] Replace hardcoded `'__someday__'` with `SOMEDAY_KEY`
- [x] Replace hardcoded `5000` toast duration with `DEFAULT_TOAST_DURATION_MS`
- [x] Replace hardcoded `7` purge days with `PURGE_RETENTION_DAYS`
- [x] Replace `new Date().toISOString().split('T')[0]` with `container.dateProvider.today()` (6 locations)
- [x] Replace `groupTasksByDate` local function with shared utility
- [x] Replace hardcoded month/day name arrays with shared constants

### Server Route Constants & Content Negotiation
- [x] Replace hardcoded route strings in server routes with `API_ROUTES` pattern constants
- [x] Use `CONTENT_TYPE_TEXT` constant in `respondNegotiated()`
- [x] Use `DEFAULT_RATE_LIMIT_RPM` in server config
- [x] Use `PURGE_RETENTION_DAYS` in repository defaults
- [x] Use `API_ROUTES.HEALTH` in server index

---

## v0.5.0: Keyboard Navigation & Command Palette

This release makes Erledigen fully operable without a mouse, and finalizes the complete keyboard shortcut system.

**Status:** COMPLETE. A single shortcut registry (`packages/client/src/lib/keybindings.ts`) now drives both the Help modal and hover tooltips on every UI action. Every shortcut in the reference table works: `j`/`k` + arrows (task focus), `J`/`K` (section jumps), `n`/`a`, `Enter` (inline edit), `e` (detail), `Space` (complete), `d` (delete), `r`/`m` (inline reschedule), `t` (inline tag editor), `1`/`2`/`3`/`0` (priority tags), `g t` (today) + `g s/p/h/c/f/x/o` (modals), `{mod}+K` / `/` (search palette), `?` (help), `{mod}+\` (Someday panel), `Esc`, `{mod}+Z` (undo), `{mod}+Shift+Z` (redo). The palette carries the full command registry with natural-language dates and `#tags` parsed in `/add`, `/go`, and `/move`.

> **Removed by the 2026-10-03 UX audit:** the command palette itself.
> Decision: no `/` commands, no command palette -- remove command mode
> and the command registry from the codebase entirely. `{mod}+K` stays
> as a plain task search; every keyboard shortcut stays; the
> natural-language date + `#tag` parsing stays (the inline add inputs
> and the Habits modal use it independently of the palette). The
> command tables below are the historical record of what shipped, not
> a plan.

### Complete Keyboard Shortcut Reference

**Navigation**
| Key | Action |
|-----|--------|
| `j` / down-arrow | Focus next task |
| `k` / up-arrow | Focus previous task |
| `J` | Jump to next day section / Someday group |
| `K` | Jump to previous day section / Someday group |
| `g t` | Jump to today |
| `g s` | Jump to Someday panel |

**Task Actions** (on focused task)
| Key | Action |
|-----|--------|
| `n` / `a` | Add new task to focused day/group |
| `e` | Open task detail modal |
| `Space` | Complete / uncomplete task |
| `d` | Delete task (undo toast) |
| `r` | Reschedule -- open date picker inline |
| `m` | Move -- opens day picker to move to another day |
| `1` | Set priority `#p1` |
| `2` | Set priority `#p2` |
| `3` | Set priority `#p3` |
| `0` | Clear priority |
| `t` | Open tag input on focused task |

**Panels & Modals**
| Key | Action |
|-----|--------|
| `Ctrl+\` | Toggle Someday panel |
| `Ctrl+]` | Toggle right control panel (future) |
| `Ctrl+[` | Collapse/expand left icon rail labels |
| `Cmd+K` | Open command palette |
| `?` | Open Help modal (keyboard shortcuts) |
| `Esc` | Cancel edit / close modal / clear focus |

**Undo / Redo**
| Key | Action |
|-----|--------|
| `Cmd+Z` | Undo last action |
| `Cmd+Shift+Z` | Redo |

### Command Palette (Cmd+K)

The palette has two modes distinguished by the first character:

**Search mode** (plain text -- no `/` prefix):
- Fuzzy search across all tasks (title, tags, notes)
- Results ranked by recency and relevance
- Selecting a result closes the palette and scrolls day list to that task's day

**Command mode** (`/` prefix):
| Command | Action |
|---------|--------|
| `/add <natural language>` | Create task (e.g. `/add buy milk tomorrow #work #p1`) |
| `/complete <text>` | Complete a task matching the text |
| `/delete <text>` | Delete a task matching the text |
| `/move <text> to <date>` | Reschedule a task |
| `/go <date>` | Jump day list to a date (e.g. `/go march 15`, `/go next monday`) |
| `/tag <text> with <tag>` | Add a tag to a matching task |
| `/filter <tag>` | Apply a tag filter |
| `/clear` | Clear all active filters |
| `/today` | Jump to today |
| `/someday <text>` | Move a task to Someday |
| `/project <name>` | Open a project |
| `/habit <name>` | Open a habit |
| `/settings` | Open Settings |
| `/help` | Open Help modal |

- Natural language dates and tags parsed in both modes.
- The palette command list is extensible -- new commands are registered by adding to the command registry in `packages/shared`.

### Additional Checklist
- [x] Vim + arrow key navigation: both work simultaneously throughout the app, in the day list and the Someday panel alike (focus navigation and the add-task target follow the focused task's home).
- [x] All shortcuts in the table above implemented and working (`J`/`K`, `r`, `m`, `t` remain).
- [x] Command palette: search mode and the full command registry (`/add`, `/complete`, `/delete`, `/move`, `/go`, `/tag`, `/filter`, `/clear`, `/today`, `/someday`, `/project`, `/habit`, `/settings`, `/help`) both functional.
- [x] Natural language date parsing: today, tomorrow, next monday, march 15, in 3 days.
- [x] Natural language task creation: `buy milk tomorrow #work #p1` (the date phrase and #tags are extracted onto the task).
- [x] Focus management: keyboard focus always visible and predictable after every action (focused task row gets an accent style; clicking a task action focuses its row).
- [x] Focus trapped inside modals; Esc closes and returns focus to the trigger element.

### Technical Notes & Considerations
- `mousetrap` or `hotkeys-js` for keybinding management. Choose one -- ADR it.
- `chrono-node` for natural language date parsing.
- Command registry pattern: commands are objects `{ prefix: string; description: string; handler: fn }` -- makes the palette extensible.
- E2E tests for all keyboard flows (written before implementation).

### Documentation & ADRs
- ADR: keybinding library choice.
- ADR: `/` command prefix convention (inspired by Notion, Slack slash commands).
- User docs: full keyboard shortcut reference page (mirrors the table above).
- User docs: command palette guide with examples.

### Definition of Done
- All UI elements reachable and operable via keyboard.
- All shortcuts in the reference table functional.
- Command palette: search, command mode, natural language add/navigate all working.
- Focus management correct throughout.
- E2E tests for keyboard navigation and command palette.

---

## v0.6.0: Polish & Responsiveness

This release polishes the three-panel layout, completes drag-and-drop interactions, implements lazy loading and view modes, and adds responsive behavior.

**Status:** COMPLETE (2026-10-03). Layout polish (true infinite scroll, resizable + collapsible Someday panel, filter persistence), drag-and-drop (reactivated by the UX audit and shipped same day -- native HTML5 DnD, see the Drag-and-Drop section), priority sort mode + the date-range filter (PR #24), and the mobile tier (bottom-sheet modals, Someday right-sheet overlay, hidden minimap, two breakpoints -- see Responsiveness).

### Drag-and-Drop (from v0.5.0)

> **Removed, then reactivated:** drag-and-drop (and the `svelte-dnd-action` dependency) was removed in the frontend simplification (commit `2f3a700`) in favor of true infinite scroll. The 2026-10-03 UX audit asked for it back ("I can't drag and drop tasks to other days or reorder tasks on the same day"), so the items below are live planned work again, tracked with the v0.15.0 audit section.

- [x] **Drag handle:** grip icon appears on the left of each task row on hover. Only the handle initiates a drag.
- [x] **Drag between days:** Drag a task from one day section and drop it onto another day's header or task list. The target day section highlights on hover.
- [x] **Reorder within a day:** Drag tasks up/down within the same day section to reorder.
- [x] **Drag to Someday:** Drag a task rightward into the Someday panel. Task's `date` is cleared on drop (becomes unscheduled). Task lands in a highlighted group, or the ungrouped bucket when dropped on panel padding (deviation from the original "first group" wording -- groups are explicit zones; nothing sneaks into a group uninvited).
- [x] **Drag from Someday:** Drag a task from the Someday panel leftward onto a specific day section header to schedule it. The target day highlights as the task hovers over it.
- [x] **Visual feedback:** Ghost image while dragging; drop zone indicator; smooth animations. (Shipped with PR: native HTML5 DnD; the dragged row dims, zones tint, and a 2px insertion line snaps to sub-task block boundaries. As-built note: `svelte-dnd-action` spiked clean on Svelte 5 but cost ~63 KB raw over the 584 KiB bundle budget -- native HTML5 won, and the budget rose to 590 KiB for the feature. Sub-tasks are not draggable: they render glued to their parent, so a cross-day sub-task move would have no visible effect; `r`/`m` remain their move path.)

### Layout Polish

- [x] **Lazy loading:** Day sections load on demand as the user scrolls (true infinite scroll in both directions, anchored on today; chunk extension also triggers recurring-instance generation for the newly loaded range).
- [x] **Panel resize & collapse:**
    - Left icon rail: fixed width, always visible.
    - Someday panel: resizable by dragging divider edge; collapsible via toggle button and `{mod}+\`; width saved to `UserPreferences`.
    - Both panels handle gracefully on smaller viewports.
- [x] **Resizable Someday panel drag handle:** The divider between the day list and the Someday panel can be dragged to resize.

### Filtering

- [x] **Priority view mode:** Accessible through the Filter modal as a sort option. When "Priority" sort is active, tasks within each day section are ordered `#p1` -> `#p2` -> `#p3` -> untagged, with a subtle left-border accent per priority level.
- [x] **Date range filter:** Add date range picker to the Filter modal. Filters tasks by date range (from/to), applies to day list and Someday simultaneously. (As built: scheduled tasks outside `[from, to]` stop rendering; date-less Someday tasks are exempt -- a range narrows the day rail, it does not empty the Someday panel.)
- [x] **Filter persistence:** Active filters persist across sessions in `UserPreferences`. Always on -- the planned "start fresh" Settings toggle is not implemented.

### Responsiveness

- [x] **Mobile:**
    - Day list fills full width.
    - Someday panel and icon rail modals accessible as bottom sheets. (As built: modals dock as bottom sheets; the Someday panel floats as a full-height right sheet over the full-width day list -- closer to desktop muscle memory than a bottom sheet. The panel header gained the v0.4.0-spec collapse button, the only touch-friendly close. The month minimap hides below 768px -- the Calendar modal covers date navigation.)
    - Bottom bar always visible. (Already flex-pinned; the Someday sheet stops 40px above the viewport bottom so the bar stays usable under it.)
- [x] **Responsive breakpoints:** Graceful degradation from desktop to tablet to mobile. (As built: two tiers -- <768px mobile, 768-1024px tablet caps the Someday panel at 45vw. Native HTML5 drag stays desktop-only by design; `m`/`r` are the touch move path. e2e covers both tiers in `tests/e2e/responsive.spec.ts`.)

### Technical Notes & Considerations
- Native HTML5 drag and drop powers the day list (decided 2026-10-03: the `svelte-dnd-action` spike cost ~63 KB raw over the bundle budget). The planned v0.9.0 Kanban drag should reuse this plumbing.
- Intersection observer for lazy loading -- avoid virtual scrolling unless performance requires it.
- CSS custom properties for theme tokens alongside Tailwind.
- Tailwind's JIT mode for optimal bundle size.
- Keyboard alternatives (move task with `m` + date picker) are covered in v0.5.0.
- E2E tests for all drag scenarios, responsive behavior, and filter scenarios.

### Definition of Done
- [x] All drag scenarios functional with visual feedback.
- [x] Dragging to/from Someday correctly clears/sets dates.
- [x] Reordering within a day persists.
- [x] Lazy loading functional with smooth scroll experience.
- [x] Panel resize/collapse working and persisted.
- [x] Priority sort mode functional.
- [x] Date range filter working in Filter modal.
- [x] Filter persistence configurable in Settings. (Decision 2026-10-03: persistence is always on by design; the start-fresh toggle is deliberately tracked in the v0.11.0 Settings list instead. Not a v0.6.0 gap.)
- [x] Mobile bottom sheet behavior functional.
- [x] E2E tests passing. (Drag + filter scenarios in drag.spec, responsive-viewport specs in responsive.spec -- 229 green in CI order.)

---

## v0.7.0: Persistence, Observability & Data I/O

This release implements persistent storage, structured logging and metrics, multi-format data export, and import from popular task managers.

**Status:** COMPLETE. Storage and observability shipped (PRs #6/#7/#8):
SQLite adapter, raw-SQL migrations, adapter contract tests,
`STORAGE_ADAPTER` config, `UserPreferences` persistence (ADR-001/
ADR-003), structured JSON logging + request IDs (ADR-004), `/api/metrics`
with the full metric catalog (ADR-005, prefix per ADR-007), and the
enhanced health endpoint. Export shipped: all four formats via `GET
/api/export` plus the Settings export UI (ADR-008) -- the JSON export
is the canonical, lossless backup (including the trash); CSV/Markdown/
iCal are active-task views. Import shipped: `POST /api/import` plus
the Settings import UI (ADR-009) -- the JSON source is a destructive
restore (pre-restore backup file, single-transaction replace,
`data:restored` broadcast); generic CSV (column mapping + auto-detect),
iCal, Todoist CSV, and Things 3 JSON import additively, with source
canceled/deleted rows landing in the trash.

### Storage
- [x] **I/O Abstraction Layer:** Solidify the adapter pattern so the application core is independent of the data source. (Repository interfaces live in `packages/shared`; services never touch SQL -- verified 2026-10-03.)
- [x] **In-Memory Adapter:** Already exists; keep for testing and ephemeral sessions. (`STORAGE_ADAPTER=memory`; drives the shared adapter contract tests and the e2e stack.)
- [x] **SQLite Adapter:** Implement a file-based SQLite adapter as the first real persistence layer (see [ADR-001](../docs/devs/architecture/decisions/ADR-001-sqlite-raw-sql-persistence.md)).
    - Zero-config for self-hosted use: single `.db` file on disk (`./data/erledigen.db`, configurable via `DB_PATH`).
    - Raw SQL via `bun:sqlite` -- no ORM (see [ADR-001](../docs/devs/architecture/decisions/ADR-001-sqlite-raw-sql-persistence.md)).
    - JSON columns for `tags[]`, `reminder`, nested objects -- repository handles `JSON.parse`/`JSON.stringify` at the boundary.
    - Schema migrations via raw SQL files (see [ADR-003](../docs/devs/architecture/decisions/ADR-003-raw-sql-migrations.md)): sequentially-numbered `.sql` files, forward-only, lightweight runner (~50 LOC).
    - Supports all entities: tasks, sub-tasks, Someday groups, projects, recurring tasks, `UserPreferences`.
    - Indexes on `tasks(date)`, `tasks(some_day_group_id)`, `tasks(parent_id)`, `tasks(recurring_task_id)`, `tasks(deleted_at)`.
- [x] **Configuration:** Select adapter via environment variable (`STORAGE_ADAPTER=sqlite|memory`, default: `sqlite`; Playwright/test runs force `memory`).
- [x] **Adapter contract tests:** The same test suite runs against both in-memory and SQLite adapters to ensure behavioral parity.

### State Persistence
- [x] **`UserPreferences` entity persisted in SQLite.** Covers:
    - Panel widths (Someday panel, future panels)
    - Last scroll position / last visited date
    - Active filters (if filter persistence is enabled in Settings)
    - Theme preference (light/dark/system)
    - Locale setting
    - All behavioral toggles (rollover, completion animation, delete confirmation, etc.)

### Structured Logging
- [x] **JSON log format:** Upgrade `ConsoleLogger` to emit structured JSON when `LOG_FORMAT=json` (production default), human-readable text when `LOG_FORMAT=text` (development default) (see [ADR-004](../docs/devs/architecture/decisions/ADR-004-structured-json-logging.md)).
- [x] **Request ID middleware:** Generate a `requestId` (UUID) per HTTP request. Attach to all logs in that request's scope via child logger pattern. Return as `X-Request-Id` response header.
- [x] **Request duration logging:** Log method, path, status code, and duration in ms for every HTTP request.
- [x] **Job-scoped logging:** Background jobs log with `jobId` and `jobType` in context.
- [x] **Child logger pattern:** `RequestLogger` wraps parent logger with default context (request ID, job ID). Services receive child loggers -- they don't manage correlation IDs.
- [x] **Error logging:** Errors always include `error.message` and `error.stack` in structured context.

### Metrics
- [x] **`MetricsAdapter` interface** in `packages/shared/src/adapters/metrics/` (see [ADR-005](../docs/devs/architecture/decisions/ADR-005-prometheus-metrics.md)).
- [x] **`PrometheusMetricsAdapter`:** In-memory counters, gauges, and histograms. Renders Prometheus text format on `/api/metrics`.
- [x] **`NullMetricsAdapter`:** No-op implementation for tests and `METRICS_ENABLED=false`.
- [x] **HTTP request metrics:** `erledigen_http_requests_total` (counter by method, path, status), `erledigen_http_request_duration_seconds` (histogram by method, path), `erledigen_http_requests_active` (gauge by method).
- [x] **Background job metrics:** `erledigen_jobs_total` (counter by type, status), `erledigen_job_duration_seconds` (histogram by type), `erledigen_jobs_pending` (gauge by type), `erledigen_jobs_running` (gauge).
- [x] **Application metrics:** `erledigen_tasks_total` (gauge), `erledigen_ws_connections_active` (gauge), `erledigen_uptime_seconds` (gauge), `erledigen_build_info` (gauge with version label).
- [x] **Path normalization:** Dynamic path segments (e.g., `/api/tasks/:id`) normalized to route patterns to prevent label explosion.
- [x] **Container wiring:** `container.metricsAdapter` -- `METRICS_ENABLED=true` (default) creates `PrometheusMetricsAdapter`, `false` creates `NullMetricsAdapter`.

### Health Endpoint
- [x] **Enhanced `/api/health`:** Rich response including `version`, `uptime`, `database` (type, path, size), `connections` (websocket count), `jobs` (pending, running counts).

### Export
- [x] **JSON** -- canonical format; lossless round-trip. All entities included (see [ADR-008](../docs/devs/architecture/decisions/ADR-008-export-format-stability.md)).
- [x] **CSV** -- flat task list; configurable columns (text, date, tags, priority, completed, notes).
- [x] **Markdown** -- task list as `- [ ] text #tags` per line, grouped by date.
- [x] **iCal / .ics** -- tasks with `startTime`/`endTime` exported as VEVENT; all-day tasks as all-day VEVENT.

### Import
- [x] **JSON** -- restore from a previous export (ADR-009: destructive replace, pre-restore backup, `data:restored` broadcast).
- [x] **CSV** -- generic task CSV with column mapping UI (index-based mapping + header auto-detect).
- [x] **iCal / .ics** -- parse VEVENT entries into tasks; sets `date`, `startTime`, `endTime`. Works with Google Calendar, Apple Calendar, Outlook exports.
- [x] **Todoist CSV** -- map Todoist's export columns to Erledigen task fields (labels, p1-p3 priorities, INDENT subtasks, note rows).
- [x] **Things 3 JSON** -- map Things 3 export format to Erledigen task fields (checklist subtasks, reminders, completed/canceled states).

### Interfaces
- [x] **`ExportAdapter<T>`** interface in `packages/shared` -- implement one adapter per format.
- [x] **`ImportAdapter<T>`** interface in `packages/shared` -- implement one adapter per format.

### Technical Notes & Considerations
- SQLite via `bun:sqlite` (built into Bun -- no extra dependency). No ORM -- raw SQL per [ADR-001](../docs/devs/architecture/decisions/ADR-001-sqlite-raw-sql-persistence.md).
- Migrations are forward-only raw SQL files per [ADR-003](../docs/devs/architecture/decisions/ADR-003-raw-sql-migrations.md). No `down()` migrations -- fix-forward is the policy.
- Keep PostgreSQL adapter for v2.3.0 when multi-user auth is added. Same repository interfaces, different SQL implementations.
- The JSON export format is documented and stable -- users can rely on it for backups.
- Import UI: a file picker in Settings > Import/Export with format selection and column mapping for CSV.
- All import adapters are tested with real export files from the source apps.
- `Logger` interface stays the same -- `ConsoleLogger` implementation gains JSON output. Child logger pattern adds context without changing the interface.
- OTEL SDK is deferred to v2.x (see [ADR-004](../docs/devs/architecture/decisions/ADR-004-structured-json-logging.md)). The current `Logger` interface is OTEL-compatible.

### Documentation & ADRs
- [ADR-001](../docs/devs/architecture/decisions/ADR-001-sqlite-raw-sql-persistence.md): SQLite with raw SQL (no ORM)
- [ADR-003](../docs/devs/architecture/decisions/ADR-003-raw-sql-migrations.md): Raw SQL migration files (forward-only)
- [ADR-004](../docs/devs/architecture/decisions/ADR-004-structured-json-logging.md): Structured JSON logging & request tracing
- [ADR-005](../docs/devs/architecture/decisions/ADR-005-prometheus-metrics.md): Prometheus-compatible metrics endpoint
- [ADR-008](../docs/devs/architecture/decisions/ADR-008-export-format-stability.md): export format stability commitment (JSON as canonical).
- [ADR-009](../docs/devs/architecture/decisions/ADR-009-import-semantics.md): import semantics (destructive JSON restore, additive task imports, upsert-by-id rejected).
- User docs: export guide ([export.md](../docs/users/export.md)) and import guide ([import.md](../docs/users/import.md)).
- Dev docs: `ExportAdapter` and `ImportAdapter` interface contracts (architecture.md adapter section + ADR-008).

### Security Considerations
- Import files are validated before processing; malformed files return clear errors.
- Markdown and notes fields sanitized on import (DOMPurify).

### Definition of Done
- [x] SQLite adapter fully implemented and tested.
- [x] All adapter contract tests pass against both in-memory and SQLite.
- [x] Schema migrations run on server start; `_migrations` tracking table created.
- [x] Structured JSON logging functional (`LOG_FORMAT=json`).
- [x] Request ID middleware attaches `X-Request-Id` header and correlates logs.
- [x] `/api/metrics` exposes Prometheus-format metrics.
- [x] `/api/health` returns rich health information.
- [x] Export working for all four formats (ADR-008; the JSON export includes the trash, view formats cover active tasks).
- [x] Import working for all five sources (ADR-009).
- [x] `UserPreferences` persisted across restarts.
- [x] Import/Export UI in Settings functional (export download + restore/import with CSV column mapping).

---

## v0.8.0: Automation & Background Jobs

This release introduces the automation features that make Erledigen smart, backed by a persistent job queue.

**Status:** Shipped (PRs #6/#7/#8). The job queue + runner (ADR-002) run
rollover and trash purge; recurring task generation deliberately stays
ON-DEMAND (not a job) -- DayList mount/scroll plus `POST
/api/recurring-tasks/generate-all`. The Settings "auto-rollover" toggle
and new trigger-time select (midnight / 9am / manual = startup-only)
now drive the schedule; missed runs are caught up at server startup.
New tasks default their `rolloverEnabled` from the app-wide preference
(server-side, `TaskService.createTask`); the per-task override still
wins. Recurring instances never roll (their occurrence date is fixed
by `instanceDate`; missed-habit handling belongs to streaks).

### Background Job System
- [x] **`JobQueue` interface** in `packages/server/src/adapters/jobs/` (see [ADR-002](../docs/devs/architecture/decisions/ADR-002-sqlite-backed-job-queue.md)).
- [x] **`SqliteJobQueue` implementation:** SQLite-backed persistent job queue (same database as application data). An `InMemoryJobQueue` serves `STORAGE_ADAPTER=memory` runs; a shared contract suite keeps the two in parity.
- [x] **`JobRunner` service:** Polls for pending jobs every 1 second (configurable via `JOB_POLL_INTERVAL_MS`). Processes jobs sequentially (single worker, concurrency=1).
- [x] **Job types:** `rollover`, `purge-deleted` (`generate-recurring` intentionally stays on-demand, not a job; `send-reminder` stubbed for v2.2.0).
- [x] **Retry with exponential backoff:** Max 3 attempts (configurable). Base delay 5 seconds (`2^attempts * base`). Failed jobs marked `dead` after max attempts.
- [x] **Startup recovery:** On server start, any `running` jobs (from previous crash) are reset to `pending`. Missed daily runs are caught up immediately; recurring jobs are chain-scheduled by their handler.
- [x] **Configuration:** `JOB_POLL_INTERVAL_MS` (default: 1000), `JOB_MAX_ATTEMPTS` (default: 3), `JOB_TIMEOUT_MS` (default: 30000), `JOB_RETRY_BASE_DELAY_MS` (default: 5000).

### Task Rollover
- [x] **Task rollover:**
    - Incomplete tasks with `rolloverEnabled: true` automatically move to the next day.
    - `originalScheduledDate` is preserved (the FIRST planned date); `daysLate` is calculated on the server (a per-task overdue badge in the day list remains small UI polish).
    - App-wide rollover default configurable in Settings (on/off, trigger time: midnight / 9am / manual -- manual means catch-up at server startup only).
    - Per-task override via the task detail modal; new tasks default from the app-wide preference.
    - Recurring instances never roll (see Status above).
- [x] **Rollover job:** Scheduled daily at the configured time (default: midnight, server timezone). Processes all incomplete tasks where `rolloverEnabled=true` and `date < today`.

### Recurring Task Generation
- [x] **Recurring tasks:**
    - Recurring task instances are auto-generated from templates.
    - Generation window: a +90-day horizon (`GENERATE_HORIZON_DAYS`) is generated when a habit is created; the DayList extends it on scroll. Not yet configurable in Settings.
    - Instances appear in the day list with a recurrence icon.
    - Completing an instance updates `RecurringTaskStats` (streak tracking: current streak, longest streak, total completions) -- stats are recomputed from instances on read (`GET /api/recurring-tasks/:id/stats`).
    - Missing a day breaks the streak.
    - Habits are created from natural-language phrases ("water plants every friday at 9am") via `parseRecurrence` in `@erledigen/shared` -- trailing phrase, live-parsed in every add input and the Habits modal.
- [x] **Recurring generation:** `generateInstances` is idempotent (skips dates that already have an instance) and is triggered on demand -- DayList mount/scroll plus `POST /api/recurring-tasks/generate-all` -- instead of by a daily job. Other tabs are notified via the `recurringTask:generated` WebSocket event.

### Trash Purge
- [x] **Purge job:** Runs daily at 3am. Permanently deletes tasks where `deletedAt` is older than `PURGE_RETENTION_DAYS` (default: 7).

### Streak Tracking
- [x] **Streak tracking:** Current/longest streak and total completions shown as badges in the Habits modal (the GitHub-style heatmap shipped with the v0.9.0 habit detail view).

### Technical Notes & Considerations
- Job queue is SQLite-backed per [ADR-002](../docs/devs/architecture/decisions/ADR-002-sqlite-backed-job-queue.md). Same database, `jobs` table.
- `rrule.js` for recurring date generation.
- Streak calculation: check if yesterday's instance was completed when today's is completed.
- All automation logic has unit tests written before implementation.
- Job metrics are exposed via `/api/metrics` (see [ADR-005](../docs/devs/architecture/decisions/ADR-005-prometheus-metrics.md)): `erledigen_jobs_total`, `erledigen_job_duration_seconds`, `erledigen_jobs_pending`, `erledigen_jobs_running`.

### Documentation & ADRs
- [ADR-002](../docs/devs/architecture/decisions/ADR-002-sqlite-backed-job-queue.md): SQLite-backed job queue

### Definition of Done
- [x] `JobQueue` interface and `SqliteJobQueue` implementation tested.
- [x] `JobRunner` processes jobs with retry and exponential backoff.
- [x] Startup recovery resets orphaned `running` jobs.
- [x] Rollover moves incomplete tasks and tracks `daysLate`.
- [x] Recurring instances appear in the day list on the correct days.
- [x] Streak statistics update correctly on completion and missed days.
- [x] Trash purge runs daily and permanently deletes old soft-deleted tasks.
- [x] All automation logic has unit tests.
- [x] Rollover settings configurable and respected.
- [x] Job metrics visible on `/api/metrics`.

---

## v0.9.0: Projects & Habits

This release builds the full UI for project management and habit tracking.

**Status:** COMPLETE (2026-10-04). Habits: done (list, create/edit/delete with live natural-language schedule parsing, streak badges, weekday/weekend schedules, the habit detail view with the GitHub-style completion heatmap, and the "make recurring" promote toggle in the task detail modal; the edit form stays on the list row). Projects: DONE (2026-10-04 -- the Kanban board with drag between
      columns, inline date editing, Activate + Auto-distribute with
      preview, and the `dependsOn` lock indicator; see the Projects
      item below). Summary: DONE (2026-10-04 -- overdue list with days-late badges, active streaks, and a combined "Next 14 Days" section for `#deadline` tasks and holidays). Calendar: done. Holidays: DONE (2026-10-04 -- Settings entry + `.ics` import, day-list banners; see the Holidays item below). The 2026-10-03 UX audit adds habits-modal UX fixes, a high-level month view for the Calendar modal, and a keep-or-remove criterion for the Summary modal -- tracked in the v0.15.0 section.

- [x] **Projects modal:** (The list, CRUD, and detail view shipped with v0.4.0; the Kanban board shipped 2026-10-04.)
    - List all projects (active and inactive).
    - Create/edit/delete projects with name, description, start date, due date.
    - **Project detail:** Kanban board with three columns -- Ready, Scheduled, Done. (As built: the columns map onto real task state -- Ready = undated, Scheduled = dated, Done = completed -- rather than the unused `state` field, so every drag is a meaningful mutation. Sub-tasks stay off the board: they render glued to their parent in the day list, so a lone sub-task move would have no visible effect.)
    - Drag tasks between columns. (Native HTML5 DnD on the v0.6.0 dragStore; drops into Scheduled land on the window-start date, adjustable inline on the card.)
    - Each scheduled task shows its assigned date. (An inline date input on the card -- shows AND edits.)
    - [Activate] button runs the auto-distribution algorithm (spreads tasks across days between start and due date). (As built: Activate confirms through the shared confirm dialog, flips `isActive`, and applies the plan in one step.)
    - [Auto-distribute] shows a preview before confirming. (`planProjectDistribution` in `@erledigen/shared` -- dependency-ordered (Kahn), round-robin across `[max(startDate, today), dueDate]`, never in the past; a past due date plans nothing.)
    - Dependency indicators: tasks blocked by incomplete predecessors show a lock icon. (As built: `dependsOn` joined the public task update API; the lock opens a blocked-by picker scoped to the project's tasks; completing the blocker releases the lock.)
    - Project tasks appear in the day list tagged with the project name (e.g., `#build-erledigen`).
> **Partially reversed by the 2026-10-04 design conversation:** the
> Kanban board, Activate, and the dependency locks are removed in
> v0.16.0 ("Projects as Umbrellas") -- projects become a gathered
> umbrella over tags, someday tabs/lists, and habits instead of a
> board over task state. The items below are the historical record of
> what shipped.
- [x] **Habits modal:** (Shipped across PRs #18/#20 and the v0.4.x habit slices -- the parent checkbox was left stale until this 2026-10-04 fix.)
    - List all recurring task templates with current streak and last completion date. (Shipped: the list with streak badges; the detail view carries the full stats.)
    - `+ new habit` flow: text + recurrence rule builder (presets: daily, weekly, monthly; custom rrule). (As built, a deliberate deviation: creation is natural-language parsing ("water plants every friday at 9am") plus the shared schedule form -- frequency/interval/day chips/day-of-month/start time. A custom rrule builder was never built, and v0.17.0 supersedes the idea: the parser is ordered anchored regexes, not an rrule engine.)
    - **Habit detail:** edit form + stats bar (current streak, longest streak, total completions) + GitHub-style completion heatmap. (Shipped 2026-09-27: stats bar + heatmap; the edit form stays on the list row.)
    - Promote any existing task to recurring: toggle "Make recurring" in the task detail modal. (Shipped 2026-09-30: via POST /api/recurring-tasks/adopt -- the task is stamped as the template's first instance; the schedule form is shared with the Habits modal through HabitScheduleForm.)
- [x] **Summary modal:** (Shipped 2026-10-04 -- the v0.15.0 keep-or-remove criterion's "sections" half: the modal now earns its open.)
    - Completion percentage for today.
    - List of overdue tasks with days-late count. (As built: most overdue first; completed past tasks stay out.)
    - Active streaks for recurring tasks. (As built: habits with a current streak > 0, longest first.)
    - Upcoming hard deadlines (tasks tagged `#deadline`) and holidays within the next 14 days. (As built: one "Next 14 Days" section, deadline tasks and holidays together, soonest first; pure derivations in `packages/client/src/lib/summary.ts` with unit tests.)
- [x] **Calendar modal:**
    - A month-grid date picker that jumps the day list to the selected date (and centers it).
    - **Today** is a full view reset: day list centered on today and the month minimap re-centered on the current month.
- [x] **Holidays in Settings:** (Shipped 2026-10-04 -- one `Holiday` row per named date, CRUD via `HolidayRepository` + migration 006, part of the JSON backup/restore per ADR-008/009.)
    - Manual entry of named dates (name + date).
    - Optional `.ics` import via URL or file upload. (As built: `POST /api/holidays/import` takes the raw `.ics` text OR a JSON `{ url }` -- the SERVER fetches the URL so the browser never hits the feed's CORS wall; duplicate (date, name) pairs are skipped, so re-importing a feed adds nothing; VEVENT parsing reuses the ADR-009 `IcalImportAdapter`.)
    - Holiday banners displayed above day section headers in the day list. (As built: a pill-shaped accent banner joins multiple same-day holidays; updates render live via the `holiday:created`/`updated`/`deleted`/`holidays:imported` WebSocket events.)

### Technical Notes & Considerations
- Kanban drag-and-drop reuses the drag infrastructure from v0.6.0.
- `rrule.js` recurrence rule builder for habit creation.
- `.ics` parsing with a library like `ical.js` (shared with v0.7.0 iCal adapter).

### Definition of Done
- [x] Projects modal fully functional with Kanban board. (Superseded by the v0.16.0 umbrella design -- see the reversal note above.)
- [x] Auto-distribution algorithm working.
- [x] Habits modal with heatmap and streak stats functional.
- [x] Summary modal shows accurate daily overview.
- [x] Calendar date picker jumps the day list correctly.
- [x] Holidays appear as banners in the day list.
- [x] "Make recurring" toggle in task detail modal works.

---

## v0.10.0: Markdown Notes

This release adds rich text support to notes -- task notes and day
notes -- plus a global view over all of them (2026-10-04 addition).

**Status:** COMPLETE (2026-10-04). A safe-by-construction markdown
renderer (ADR-015) powers live rendering everywhere; day notes are a
new `DayNote` entity (one per date) in the day sections and the
export snapshot; the Notes modal is a 10th rail slot (`g n`).

**2026-10-03 UX audit:** the editing
model becomes Obsidian-style live rendering -- notes render as
Markdown, and only the line under the cursor drops back to raw
syntax (a rendered heading shows as `# header` while that line is
edited). The task title uses the same live model. The edit/view
toggle below is superseded; sanitization applies unchanged, and task
rows gain a has-notes indicator.

- [x] **Markdown rendering:** Task notes (the `notes` field) are rendered as Markdown in the task detail modal.
    - Supports: headings, bold, italic, inline code, code blocks, lists, links.
    - Live editing (supersedes the toggle): rendered Markdown everywhere; the line under the cursor shows raw syntax while it is edited.
- [x] **Sanitization:** All user-provided HTML is sanitized before rendering to prevent XSS. (As built: safe by construction,
      ADR-015 -- the renderer escapes first and never passes raw
      HTML through, so there is nothing to sanitize after the fact;
      adversarial inputs are tested in `markdown.test.ts`.)
- [x] **The task title uses the same live model** -- rendered, with
      only the line under the cursor showing raw syntax. (As built: a
      title is one line, so the existing inline edit IS the raw view;
      the row renders `renderInlineMarkdown` -- `# Morning` renders as
      a bold section-style line, groundwork for the v0.17.0
      in-day sections -- and the accessible name keeps the raw
      source. Rendered links inside a title follow the link instead
      of opening the edit.)
- [x] **Has-notes indicator:** a subtle marker on task rows whose
      `notes` is non-empty (UX-audit finding riding this version).
- [x] **Day notes, the paper calendar's margin:** one live-markdown
      field per day -- a subtle affordance in the day section,
      collapsed when empty. Never a task, never reorderable; part of
      the day in the export backup. Reuses the same live-markdown
      machinery as task notes. (As built: a new `DayNote` entity --
      one row per date, `PUT /api/day-notes/:date` upsert,
      `DELETE` on clear; rides the snapshot as the optional
      `dayNotes` key, the same ADR-008 rule holidays used. Saves are
      debounced 800 ms; the affordance's first click jumps straight
      into the raw line.)
- [x] **Notes modal, the global view:** a lens over every note in the
      system -- day notes and task notes grouped by their owner (day
      sections in date order; task notes listed under their task),
      each entry editing the owner's note in place and hopping back
      to it (the day in the list, the task's detail). Notes only ever
      exist attached to a task or a day; the modal never creates
      standalone notes -- it reads and edits, it never owns.
      (As built: rail slot -- a 10th icon-rail item, `g n`; undated
      task notes group under a trailing "Someday" section.)

### Technical Notes & Considerations
- ~~`marked` for Markdown parsing.~~ (As built, 2026-10-04: a
  hand-written renderer in `packages/shared/src/utils/markdown.ts`
  instead -- the bundle gate stood at 623 of 624 KiB and
  marked+DOMPurify would add ~60 KB raw; the SSR app needs identical
  server/client output, which DOMPurify (a DOM library) cannot give
  without jsdom; and the required grammar is six constructs. See
  [ADR-015](../docs/devs/architecture/decisions/ADR-015-safe-by-construction-markdown.md).)
- ~~`DOMPurify` for sanitization.~~ (Superseded by the same ADR-015:
  escape-first construction.)
- XSS sanitization tested with adversarial inputs as part of TDD.
  (Shipped: the adversarial battery in `markdown.test.ts` -- script,
  iframe, style/form injection, `javascript:`/`data:`/`vbscript:`
  hrefs, entity-encoded payloads, href quote-breakouts, and a
  quote-aware attribute walk asserting no foreign attribute can ever
  appear.)
- The grammar is line-oriented by design (every non-blank source line
  is one block; no soft-wrap joining) -- it matches the paper-calendar
  identity and gives the live editor an exact line-to-block mapping
  for click-to-edit.
- Bundle budget raised 624 -> 664 KiB for the whole live-markdown
  system (renderer, live editor, day-note field, Notes modal); the
  v0.16.0 Kanban removal pays it back later.

### Security Considerations
- ~~All rendered Markdown is run through DOMPurify before insertion into the DOM.~~ (As built: nothing reaches the DOM that was not
  escaped at emission; the renderer's only tags are its own
  literals -- ADR-015.)
- Content Security Policy prevents inline script execution even if sanitization is bypassed.

### Definition of Done
- [x] Live markdown everywhere: task notes, the task title, and day notes
  render; only the edited line shows raw syntax.
- [x] Day notes render in every day section (collapsed when empty) and ride
  the export backup.
- [x] The Notes modal views and edits every note, grouped by owner, with
  hop-back.
- [x] Has-notes indicator on task rows.
- [x] XSS sanitization tested with adversarial inputs.

---

## v0.11.0: Theming & Customization

This release finishes the theme system and the Settings experience.
(2026-10-04 restructure: the general style pass moved to v0.18.0,
which runs after the v0.16.0/v0.17.0 rebuilds; the Theme modal and
the logo-derived accents moved here -- theming is this version's
whole job.)

### Design System & Theming
- [x] **Design system:** Established a consistent visual language using Tailwind + CSS custom properties.
    - Inspired by Basecamp / 37signals (Fizzy): clean, spacious, warm, calm. No clutter.
    - Typography: system font stack (no web fonts).
    - Spacing, border radius (pill buttons), layered shadows, and an OKLCH color scale defined as CSS variables in `app.css` (light + dark).
    - Design tokens reviewed in Storybook.
- [x] **Theme system:** Light, dark, and system default, stored in `UserPreferences` and switchable in Settings (as shipped today).
- [ ] **Dedicated Theme modal** (UX-audit finding, moved here
      2026-10-04): theming is not Settings. Add a Theme modal to the
      icon rail where users select the app's theming, and move ALL
      theming/appearance settings out of the Settings modal into it.
- [ ] **Accent color schemes:** draw the accent palette from the
      logo's colors so the brand reads through the whole UI
      (UX-audit finding, moved here 2026-10-04).
- [ ] **Tag colors:**
    - Tags are auto-assigned distinct pastel colors on creation.
    - User can override the color for any tag in Settings > Tags.
    - Tag chips in task rows and filter bar reflect the color.
- [ ] **Tag management screen** (in Settings):
    - List all tags with their colors.
    - Rename, merge (combine two tags), delete, recolor.
- [ ] **Animations & transitions:** Subtle and purposeful -- task completion fade, modal open/close, panel collapse, drag ghost.
      (The visual-consistency audit and Storybook design review moved
      to v0.18.0, the polish pass.)

### User Preferences (Settings)
- [ ] **Font size:** Small, medium (default), large. Adjusts `--font-size-base` CSS variable globally.
- [ ] **Task row density:** Compact (tight spacing) vs comfortable (spacious, default).
- [ ] **Completion animation:** Configurable -- strikethrough+fade, stay grayed, or hide immediately.
- [x] **Delete behavior:** Instant + 5s undo toast (default) vs require confirmation dialog -- configurable in Settings (`deleteConfirmation`).
- [x] **Rollover defaults:** App-wide on/off, trigger time (midnight / 9am / manual) -- shipped with v0.8.0.
- [ ] **Empty day visibility:** the day-list behavior shipped with
      v0.4.0; the Settings toggle remains to be built.
- [ ] **Filter persistence:** Persist active filters across sessions (default) vs always start fresh.
- [x] **Panel defaults:** Someday panel open/closed and icon-rail
      label visibility, persisted -- shipped with v0.4.0/v0.4.1.
- [ ] **Custom keyboard shortcuts:** User can remap any shortcut via Settings > Keyboard. Overrides stored in `UserPreferences`. Conflicts shown with a warning.
- [x] **All preferences persisted** in `UserPreferences` (SQLite).
      Survive restarts and browser refreshes -- shipped with v0.7.0.

### Privacy Principle
- No analytics, no telemetry, no tracking -- not even anonymized. Erledigen knows nothing about how you use it except what you explicitly store in your own database.
- Document this commitment explicitly in the user docs.

### Technical Notes & Considerations
- Tailwind's dark mode with `class` strategy for manual toggle support.
- CSS custom properties for tokens that need to be dynamic (theme switching, tag colors).
- Svelte's built-in transition functions for animations.

### Documentation & ADRs
- ADR: design system approach (Tailwind + CSS custom properties).
- ADR: `UserPreferences` schema and persistence strategy.
- Dev docs: design system reference (tokens, typography, spacing).
- User docs: full Settings reference.

### Definition of Done
- Theming lives in its own Theme modal (light/dark/system switchable
  there); the Settings modal keeps only behavior.
- Accent color schemes functional, drawn from the logo's colors.
- Tag colors auto-assigned and user-overridable; the tag management
  screen is functional.
- All remaining preference categories implemented, functional, and
  persisted.
- Custom keyboard shortcut remapping working.
- Animations are smooth, purposeful, and reduced-motion-safe.
- Privacy principle documented in user docs.

---

## v0.12.0: Accessibility

This release ensures Erledigen meets WCAG 2.1 Level AA accessibility standards across every surface.

- [ ] **Full keyboard operability:** Every action reachable via keyboard (prerequisite: v0.5.0). Audit confirms no mouse-only interactions remain.
- [x] **ARIA roles and labels:** All interactive elements (buttons, inputs, modals, drag handles) have correct ARIA attributes. Icon rail buttons have `aria-label`, modals have `role="dialog"`, `aria-modal`, `aria-label`.
- [ ] **Screen reader testing:** Manually tested with NVDA (Windows) and VoiceOver (macOS/iOS). Key flows: add task, complete task, navigate the day list, open the search modal.
- [x] **Focus management:**
    - Always visible focus ring throughout (no `outline: none` without a custom visible replacement).
    - Logical tab order in all panels.
    - Modals: focus trapped inside; Esc closes and returns focus to the trigger element.
- [ ] **Color contrast:** All text meets 4.5:1 ratio (normal text) and 3:1 ratio (large text) in both light and dark themes. Automated check in CI with `axe-core`.
- [ ] **Reduced motion:** Respect `prefers-reduced-motion`. All animations disabled or minimized when the user has set this OS preference.
- [x] **Skip-to-content link:** Visible on first Tab keypress; skips the icon rail and jumps to the day list.
- [ ] **Form inputs:** All inputs have associated `<label>` elements. Error states are announced to screen readers via `aria-live`.
- [ ] **Automated a11y CI check:** `axe-core` integrated into the Playwright E2E suite. Every page/modal/component checked on each test run.

### Technical Notes & Considerations
- `axe-core` + `@axe-core/playwright` for automated accessibility testing.
- Manual screen reader testing is required for full coverage -- automation only catches ~30-40% of issues.
- Retrofit any a11y debt accumulated in earlier releases.

### Documentation & ADRs
- ADR: WCAG 2.1 AA as the accessibility standard. Tooling: axe-core.
- User docs: accessibility guide (keyboard navigation, screen reader support, reduced motion).

### Definition of Done
- axe-core reports zero violations across all pages and components in CI.
- Manual screen reader test passes for core workflows (NVDA + VoiceOver).
- Color contrast audit passes (all text meets AA ratios).
- `prefers-reduced-motion` respected throughout.
- Focus management correct in all modals and panels.

---

## v0.13.0: Internationalization

This release adds infrastructure for multiple languages and locale-aware formatting.

- [ ] **`I18nAdapter` interface** defined in `packages/shared`. Pluggable locale providers implement it.
- [ ] **String extraction:** All user-facing strings extracted into locale files (`locales/en.json` as the canonical source). No hardcoded strings in components.
- [ ] **Default locale:** English (`en`). All existing strings catalogued and placed in `en.json`.
- [ ] **Locale selection:** Settings > Language dropdown. Selected locale stored in `UserPreferences`.
- [ ] **Date/time formatting:** Locale-aware using the `Intl` API. Day section headers, task dates, and times respect the selected locale.
- [ ] **Number formatting:** Task counts and stats use `Intl.NumberFormat`.
- [ ] **RTL layout architecture:** CSS layout is RTL-ready (logical properties: `margin-inline-start` not `margin-left`). No RTL language ships in this release, but adding one requires only a locale file and `dir="rtl"` on `<html>`.
- [ ] **Pluralization:** Plural forms handled correctly (e.g. "1 task" vs "2 tasks") via the i18n library.

### Technical Notes & Considerations
- Recommended library: `paraglide-js` (compile-time i18n, zero runtime overhead) or `svelte-i18n`.
- Locale files are JSON. Community translations contributed via pull requests.
- Only `en` ships in v0.13.0. Other languages added in subsequent releases as community contributions.

### Documentation & ADRs
- ADR: i18n library choice and locale file format.
- Dev docs: how to add a new language (locale file format, contribution guide).
- User docs: how to change the language in Settings.

### Definition of Done
- All user-facing strings in locale files. Zero hardcoded UI strings.
- Locale switching functional in Settings.
- Date/time formatting locale-aware.
- RTL layout using logical CSS properties throughout.
- Locale files validated in CI (no missing keys).

---

## v0.14.0: Calendar Time-Grid View

> **Deferred (2026-10-04 whole-app coherence pass):** an hour-grid is
> Google Calendar's shape, not a calendar book's -- it fights the
> product identity ("automated paper calendar"). Time-awareness ships
> where you live instead: times on tasks + arrival ordering by time
> (v0.17.0), the "# Morning" sections, and the Calendar modal's
> month-density overview (v0.18.0); external events bridge through
> `.ics` import. Revisit a grid only if lived experience demands
> minute-precision scheduling after v0.17.0.

This release adds a time-grid calendar view for tasks with start and end times.

- [ ] **View toggle:** The Calendar rail icon now offers two modes: `List` (the existing day list) and `Calendar` (time grid). Toggle saved to `UserPreferences`.
- [ ] **Day view:** A 24-hour vertical time grid for a single day. Tasks with `startTime`/`endTime` appear as time-block cards. All-day tasks appear in a row above the grid.
- [ ] **Week view:** Seven-column time grid (Mon-Sun). Same block display.
- [ ] **Quick-add from grid:** Click any time slot -> inline input with that time pre-filled -> creates a task with `startTime` set.
- [ ] **Drag to reschedule:** Drag a time block to a new slot or day. Updates `date`, `startTime`, `endTime` on drop.
- [ ] **Resize to change duration:** Drag the bottom edge of a block to change `endTime`.
- [ ] **All-day tasks:** Tasks without `startTime`/`endTime` appear in the all-day row; can be dragged onto the grid to add a time.

### Technical Notes & Considerations
- Evaluate a SvelteKit-compatible calendar grid library or build a bespoke grid using CSS grid.
- Reuse drag infrastructure from v0.6.0 where possible.
- Keyboard navigation within the time grid: arrow keys move between time slots; Enter to add task.

### Definition of Done
- Day and week time-grid views functional.
- Time-block tasks display, drag-to-reschedule, and resize all working.
- Quick-add from time slot working.
- View toggle persisted.
- All-day task row functional.

---

## v0.16.0: Projects as Umbrellas

**Status:** Designed 2026-10-04 (recorded as
[ADR-011](../docs/devs/architecture/decisions/ADR-011-projects-as-umbrellas.md)) (from living with the shipped v0.9.0 Kanban;
all decisions below are recorded from that conversation). Queued after
v0.13.0 per the numeric-order policy (v0.14.0 is deferred; the
v0.15.0 polish pass renumbered to v0.18.0 runs after the rebuilds).
This section absorbs the UX audit's Someday tabs/lists redesign and
reverses parts of the shipped v0.9.0 Projects feature.

A project is a group of tasks that all build up to the same thing -- a
school assignment, a coding project, a house project: related work
spanning multiple days under one umbrella.

The v0.9.0 Kanban did not survive real use -- a scheduled task has
no stages beyond done, so a board over real task state cannot mean
anything. The settled shape is different: **a project is a
higher-level abstraction that GATHERS related work instead of
containing it** -- a named tag, clean metadata, and one gathered view.
Never a second home for tasks.

### The model: two worlds, one umbrella

- **The tag is the join key.** Every member of a project already has
  tags: tasks (`Task.tags`), routines (`Routine.tags` -- the entity
  renamed from RecurringTask by v0.17.0), someday lists
  (`SomeDayGroup.tag`). A project owns its tag; anything
  carrying it is gathered into the project's view. No new task-level
  fields, no stages, no board.
- **Backlog world vs. calendar world.** Undated work parks in someday
  lists (the planning surface, where the kanban idiom is true).
  Dated work lives on days (the doing surface). Scheduling moves a
  task between worlds; clearing the date returns it to its list. A task is
  in exactly one world at a time, and a scheduled task has no
  lifecycle beyond done.
- **Project = metadata + gathered view.** Name, description,
  start / due / completed dates, hill progress. The modal is a lens
  over work that lives elsewhere, never a container.

### Someday: tabs and lists

- [ ] Someday becomes tabs holding lists (replacing the tag-based
      groups). Default: one tab with one list, both named "Someday",
      no title shown; minimal, to the point, easy.
- [ ] Lists are not tied to a date; tasks parked in them are undated
      backlog.
- [ ] **Auto-tab:** creating a project automatically creates a
      someday tab named for it, empty with "+ add list" ready. The
      project's lists (its shelves) live in its tab.
- [ ] **Scheduling bridge:** drag a parked task onto a day section
      (or set a date) and it becomes a day task wearing the project
      chip; clear the date and it returns to its list.
- [ ] The panel keeps its name: it stays the **Someday panel** even
      with tabs (the default tab is also named Someday).
- [ ] Plain lists carry no tag of their own; a project tab's lists
      inherit the project's tag. The old someday-group `tag` field
      dies with the redesign -- tags mean priority, project, routine,
      or free-form, nothing else.
- [ ] Sub-tasks nest under their parents in every surface (the
      UX-audit finding applies to the new tabs and lists too).
- [ ] OPEN QUESTION (carried from the UX-audit notes): does the
      Someday area stay the right-hand drawer or become its own
      modal? Explore both before building the tab chrome.

### The project home (Projects modal)

- [ ] **Gathered view, Fizzy-grade:** Backlog (the project's undated
      tasks grouped by their someday lists), Scheduled (dated tasks as
      a compact strip grouped by day), Routines (the project's
      routines with streaks; ended routines show their until -- built
      in v0.17.0), Done (count + recent).
- [ ] **Metadata row:** start / due / completed dates (premium inline
      controls) + the hill progress control + "Mark complete".
- [ ] **Create from the project:** "+ add task" (undated, auto-tagged,
      lands in the backlog), "+ add habit", "+ add list" -- every
      creation path auto-applies the project tag, which is the whole
      linking mechanism.
- [ ] **Cross-links:** someday lists show a project chip; habits and
      day-list tasks show theirs (existing chips); each hops to the
      project home. Clicking a scheduled task scrolls the day list to
      it.

### Progress: the Basecamp hill

- [ ] A hill-style progress control: the user drags ONE marker on a
      small hill -- uphill means "figuring it out", the top means
      "scope settled", downhill means "executing". No percentage; the
      hill is the language.
- [ ] The user sets it by hand (Basecamp's philosophy: the user knows
      what "done" feels like; stuck near the top for a month is
      normal, and the app never auto-anything).
- [ ] **"Mark complete"** is explicit and stamps `completedAt` (which
      draws the completion note in the day list). Progress never
      auto-triggers it.

### Milestones in the day list

- [ ] Banner-style notes on the project's dates: "X starts", "X due",
      "X completed" (same family as the holiday banner, visually
      distinct).
- [ ] **Nag on today:** an uncompleted project keeps drawing its
      due-date note on today ("X was due Oct 12") until it is marked
      complete.

### Routines with an `until` -- moved to v0.17.0

> The until item moved to v0.17.0 ("Routines"), which owns the
> routine model, its naming, and the parser that reads until
> phrases. v0.17.0 builds it as part of the routine control set.

### Removals (v0.9.0 reversals)

- [ ] Remove the Kanban board and its component -- the derived
      Ready/Scheduled/Done columns die with it (the two-world model
      replaces them).
- [ ] Remove Activate and the active/inactive distinction; `isActive`
      drops from the UI and the schema (the only project states are
      its dates).
- [ ] Remove the dependency locks and the blocked-by picker; the
      `dependsOn` field stays dormant in the model (tested, harmless).
- [ ] No auto-distribute button; `planProjectDistribution` stays
      dormant in shared. If spreading a backlog across a due-date
      window is missed, it can return as an affordance on a project
      tab.

### Definition of Done

- [ ] Projects gather tasks, habits, and someday lists by tag, with no
      new task-level fields.
- [ ] Creating a project creates its someday tab; lists park undated
      backlog; the scheduling bridge works both directions.
- [ ] The project home shows the gathered view with hill progress,
      dates, and creation affordances.
- [ ] Day-list milestone notes render on start / due / completed
      dates, and overdue notes nag on today until completed.
- [ ] The board, active/inactive, and dependency locks are gone; the
      removals are recorded in the v0.9.0 section. (The routine
      `until` shipped by v0.17.0 rather than here.)

---

## v0.17.0: Routines

**Status:** Designed 2026-10-04 (recorded as
[ADR-012](../docs/devs/architecture/decisions/ADR-012-export-snapshot-v2-routines-rename.md)
for the rename + snapshot v2, and
[ADR-013](../docs/devs/architecture/decisions/ADR-013-arrival-insertion-manual-sovereignty.md)
for arrival insertion and manual sovereignty) (from living with the shipped habits /
recurring split; all decisions recorded from that conversation).
Queued after v0.16.0. Absorbs the UX audit's recurring/habits
findings and pulls the `until` item in from v0.16.0. One decision
drives everything: the feature has ONE name, everywhere --
**routines**.

A routine is any repeat you live with: "water the plants every mon
and wed at 8am", "pay rent monthly", "study every weekday until the
exam". The word fits the until semantics (a routine ends) and the
project umbrella (projects gather routines by tag). "Habit" and
"recurring task" both die as user-visible words -- they were never
two things.

### One name: routines everywhere

- [ ] **Full rename, one deliberate breaking pass** (pre-1.0, so now
      is the cheap time): entity `RecurringTask` -> `Routine`; routes
      `/api/recurring-tasks` -> `/api/routines` (including adopt,
      generate, generate-all, stats); the task field
      `recurringTaskId` -> `routineId`; WS events
      `recurringTask:generated` -> `routine:generated`; stores,
      services, components, stories, e2e specs, Bruno files, and
      user docs all follow. The Habits modal becomes the Routines
      modal; "Make recurring" becomes "Make routine".
- [ ] **Storage migration:** rename `recurring_tasks` -> `routines`,
      `recurring_task_stats` -> `routine_stats`, and
      `tasks.recurring_task_id` -> `tasks.routine_id`.
- [ ] **Export snapshot v2 (ADR-008):** `recurringTasks` -> `routines`
      and `recurringTaskId` -> `routineId` bump the snapshot version
      to 2; the restore path accepts BOTH v1 and v2 so existing
      backups keep restoring.

### The grammar (NL, higher quality)

- [ ] **Tags compose:** `#tags` and the recurrence phrase parse
      together in any order ("water plants #home every mon and wed"
      == "water plants every mon and wed #home") -- the tags land on
      the template and its instances.
- [ ] New phrases: "until <date>" (ends the routine), "starting
      <date>", "twice a day", multiple times ("at 9am and 5pm" --
      the model grows `times[]` from a single startTime; one instance
      generated per time), "the first/last <weekday> of the month",
      "biweekly", "quarterly", time ranges ("4 to 5pm" -- instances
      carry startTime + endTime), and richer day lists.
- [ ] The parser stays trailing-only, built as ordered anchored
      regexes, fully unit-tested (the Bun backtracking rule from
      code-standards.md).

### The blend: NL and controls, one surface

- [ ] Type NL; the manual controls auto-populate and stay editable;
      touching any control rewrites the text to the canonical
      phrase; the live hint always shows the understood schedule.
      The words and the controls can never disagree.

### The Routines modal (minimalistic, powerful, easy)

- [ ] Rebuild as an orderable list of routine cards (drag sets the
      routine order): name, canonical schedule, streak, paused/ended
      state. Creation is NL-first with the blend form.
- [ ] The detail carries the heatmap, trimmed stats (the UX-audit
      finding: no instance count, no empty stats for fresh routines),
      and the full control set:
- [ ] **Until date** ("until June 1" parses; the schedule form gains
      an Until field; generation stops past it; an "ended" state
      shows afterwards).
- [ ] **Pause/resume:** generation stops while paused; existing
      instances stay real tasks; resume continues. Same semantics as
      ended, but manual and reversible.
- [ ] **Editable start date** (affects future generation only).
- [ ] **Richer monthly rules:** first/last weekday of the month.
- [ ] **Per-occurrence edits made obvious:** instances are real
      tasks; changing one day's occurrence never touches the template
      -- surface that affordance instead of leaving it implicit.
- [ ] **Schedule edits offer to reshape future instances:** editing a
      routine's schedule offers to delete uncompleted future instances
      and regenerate them on the new schedule; completed history is
      never touched.
- [ ] Delete keeps past completed instances and removes the rest
      (future + incomplete) -- the UX-audit finding.

### From the day list

- [ ] The recurrence icon on a task row is clickable: opens the
      Routines modal at that routine's detail -- the UX-audit finding.
- [ ] From the detail, jump to the routine's instances on days (the
      way back).

### Day-list ordering: automated insertion, manual sovereignty

- [ ] **Routine order drives arrival order:** the drag order in the
      Routines modal positions freshly generated routine instances on
      a day, relative to each other.
- [ ] **Time drives insertion:** a task created with a time slots in
      by time among the day's timed tasks; tasks without a time land at the
      bottom. (Both apply to ARRIVALS only.)
- [ ] **Manual wins and sticks:** once you drag a row, that day's
      placement is yours -- nothing reorders itself continuously.
      Automation only ever positions arrivals, never existing rows.
- [ ] **Retire the priority sort mode** (2026-10-04 whole-app pass):
      a continuous sort violates manual sovereignty -- ordering
      belongs to arrival insertion plus manual drags. Priority tags
      (p1/p2/p3) stay as colored tags; the Filter modal's sort option
      goes (a v0.6.0 reversal, like the board reversal).
- [ ] **User-defined sections:** a task whose text starts with
      `# ` (e.g. "# Morning") renders as a section header inside the
      day -- the same syntax as the v0.10.0 live-markdown titles --
      and carries its own inline add beneath it. Sections and tasks
      are one manual sequence; a task belongs to the section above it
      by position. Tags are `#word` with no space, so "# Morning" can
      never collide with tagging.

### Definition of Done

- [ ] One word: no user-visible "habit" or "recurring task" remains;
      the codebase, API, storage, and export all say routine.
- [ ] Old (v1) JSON backups still restore on the renamed model.
- [ ] NL covers every grammar form above and composes with tags; the
      blend keeps words and controls in agreement.
- [ ] Routine order + time drive arrival placement; manual drags
      stick; `# ` section tasks render as headers with inline add.
- [ ] The row icon opens the routine detail; instance jumps work both
      directions.
- [ ] Routines have until, pause, editable start date, monthly rules,
      multi-times, and schedule edits that offer to reshape the
      future.

---

## v0.18.0: Gold-Standard Polish

> Renumbered from v0.15.0 (2026-10-04 restructure). The polish pass
> runs LAST -- after the v0.16.0 projects/someday rebuild and the
> v0.17.0 routines rebuild -- so it polishes final surfaces instead
> of doomed ones, and the numeric-order policy keeps holding.

Findings from the 2026-10-03 UX audit of the shipped app (raw notes:
[issues.md](issues.md), kept verbatim -- the cspell dictionary
absorbs the raw spellings; 27 findings total). The audit's verdict:
the app is going in the right direction but needs work in polishing,
refining, and getting to a gold standard. This pass carries the
findings whose home is polish itself. The rest moved to their home
versions:

- Live markdown + the has-notes indicator -> v0.10.0 (notes)
- The Theme modal + logo-derived accents -> v0.11.0 (theming)
- The Someday tabs/lists redesign -> v0.16.0 (absorbed with projects)
- Every recurring/habits finding (delete semantics, trim stats, NL +
  tags compose, row icon -> detail, ordering) -> v0.17.0 (routines)
- Sub-tasks under parents everywhere -> a v0.16.0 build requirement
- Drag-and-drop reactivation -> shipped with v0.6.0

### Shell & Bottom Bar

- [ ] **Docs link on the site:** a visible link to the user docs -- the
      v0.4.0 spec had a far-right bottom-bar `docs ->` link, lost in
      the frontend simplification. Docs strategy: do not document
      everything; document the advanced things (natural-language
      input, routine schedules, filtering, import/export, keyboard
      shortcuts).
- [ ] **Remove the store-wide task counter:** the bottom-right
      `{total} tasks {done} done` readout counts the entire loaded
      store ("245 tasks 0 done") and carries no meaning. Remove it;
      keep the date/clock button.
- [ ] **Print the week:** a print stylesheet for the day list -- print
      this week's pages, stick it on the fridge. Pure CSS print media
      (a 2026-10-04 coherence-pass nicety, very on-identity).

### Notifications

- [ ] **A Notification modal:** today notifications are transient
      toasts only. Add a dedicated Notification modal (rail icon)
      that surfaces what happened and what the app is doing -- a
      lens, never a second inbox. See the transparency item below.

### Style & Branding

- [ ] **Calendar-book vibes:** a broader style pass -- simpler, more
      minimal, more idiomatic across pretty much everything, in the
      direction of a paper calendar book.
- [ ] **Visual consistency + Storybook review:** every modal, panel,
      form, and interaction reviewed against the design system; no
      orphaned styles (moved from v0.11.0).
- [ ] **Settings restyle:** the Settings modal looks bad today --
      functional but plain. Restyle it with the design system
      (post-v0.11.0 it also holds only behavior, not appearance).
- [ ] **Transparency and openness:** a principle for the whole pass --
      the app stays as minimal yet useful as possible, with
      transparency and openness built in (no hidden machinery; the
      app shows what it is doing).

### Search

- [ ] **Remove the `/` command palette entirely** (decision,
      2026-10-03): strip command mode and the command registry from
      the codebase. `{mod}+K` stays a plain task search. Keyboard
      shortcuts stay -- they are independent of the palette. The
      natural-language date + `#tag` parsing stays (the inline add
      inputs and the Routines modal use it independently). See the
      v0.5.0 section note.

### Day List & Filtering

- [ ] **Drag the task itself, not the grip:** today only the hover
      grip initiates a drag (so text stays selectable). The row
      should be draggable by default -- click to edit, drag to move,
      no visible handle.
- [ ] **Filter by task title text:** the Filter modal filters by tags
      only today. Add a text filter over task titles (applies to the
      day list and Someday together, like the other filters).

### Calendar

- [ ] **High-level month view:** the Calendar modal is navigation-only
      today and overlaps the month minimap. Give it a real overview:
      per-day task/appointment density in the month grid, so users
      can see at a high level what is coming throughout the month.

### Stats

- [ ] **Rename, per the 2026-10-04 verdict:** the Summary modal becomes
      the **Stats modal** (rail label + modal title follow; the
      shipped sections stand).

### Technical Notes & Considerations

- The palette removal touches the Search modal, the command registry,
  the Help modal, e2e coverage, and the v0.5.0 user-docs pages;
  keyboard shortcuts and plain search keep their tests.

### Definition of Done

- Every remaining audit finding shipped, or closed with a recorded
  decision.
- The command palette is gone from the codebase; `{mod}+K` search and
  the full keyboard shortcut table still pass e2e.
- The bottom bar carries a docs link and no store-wide counter; the
  week prints.
- Rows drag themselves; the Filter modal has a title-text filter.
- The Calendar modal shows month density.
- The Stats modal carries its new name; the style pass (calendar-book
  vibes, Settings restyle, visual consistency) is done and the
  transparency principle holds.

---

## v1.0.0: Public Release

The first stable, fully usable release of Erledigen. Goal: a complete daily driver for a single self-hosted user.

- [ ] **Feature complete:** All v0.x features integrated and working end-to-end.
- [x] **SQLite persistence:** All data persists reliably across restarts (ADR-001).
- [x] **Background jobs:** Rollover and trash purge run via the persistent job queue (ADR-002); recurring generation is on-demand by design.
- [x] **Structured logging:** JSON logs with request IDs in production (ADR-004).
- [x] **Metrics endpoint:** `/api/metrics` exposes Prometheus-format metrics (ADR-005).
- [x] **Rich health endpoint:** `/api/health` returns version, uptime, database status, connection counts.
- [ ] **Monitoring stack:** `docker-compose.monitoring.yml` ships with Prometheus + Grafana + Loki + Uptime Kuma (ADR-006).
- [ ] **Full keyboard operation:** Every action reachable without a mouse. All shortcuts from v0.5.0 working.
- [ ] **Search:** `{mod}+K` plain task search functional. (The `/` command palette was removed by the 2026-10-03 audit decision -- see the v0.5.0 and v0.18.0 sections.)
- [ ] **Projects & Routines:** umbrella projects (v0.16.0) and routines with streaks (v0.17.0) -- the v0.9.0 Kanban design is superseded.
- [x] **Rollover automation:** Incomplete tasks roll over by default; overdue indicators shown (a per-task days-late badge remains small UI polish).
- [ ] **Tag system:** Full tag management -- colors, rename, merge, delete.
- [ ] **Light & dark themes:** Polished and complete.
- [x] **Notes:** live-markdown notes on tasks and days, with the global notes view (v0.10.0).
- [x] **Trash & undo:** 7-day trash, undo toasts, Cmd+Z.
- [x] **Holidays:** Manual + .ics import; banners in day list.
- [ ] **Import/Export:** JSON, CSV, Markdown, iCal, Todoist CSV, Things 3 JSON all working.
- [ ] **Start/end times:** Task model and detail modal support time fields. Calendar time-grid view functional. (The time-grid itself stays deferred -- see the v0.14.0 section.)
- [ ] **Accessibility:** WCAG 2.1 AA audit passed. axe-core CI check green.
- [ ] **Internationalization:** All strings in locale files; locale switching functional.
- [ ] **User customization:** All preferences functional and persisted.
- [ ] **Docs link:** Bottom bar docs link working; Writebook user docs live and linked.
- [x] **Help modal:** All keyboard shortcuts documented and accurate (single registry shared with hover tooltips).
- [x] **Mobile:** Bottom sheet behavior for panels on small screens (shipped with v0.6.0).
- [x] **Dockerized:** A single `docker compose up` starts the full application (dev, prod, and test stacks).
- [x] **CI/CD pipeline:** Tests run on every push (dockerized test stack); building a release Docker image on release remains planned.
- [x] **Security headers:** All API responses include security headers.
- [ ] **ADRs:** Written for all significant decisions made during v0.x.
- [ ] **Performance:** Day list loads in <100ms; lazy loading keeps scroll smooth.

### Definition of Done
- Application is a fully usable, self-hosted daily task manager.
- Single user, no authentication required.
- All E2E and unit tests passing.
- Biome checks passing.
- Docker deployment working.
- User docs live on Writebook.

---

## v2.0.0: CLI

Adds a full-featured command-line interface in a new `packages/cli` package.

- [ ] **Package setup:** `packages/cli` using Bun, communicates with the server over HTTP REST.
- [ ] **Command-based mode:**
    - `erledigen add "buy milk tomorrow #work #p1"` -- natural language task creation
    - `erledigen list [--today] [--tag work] [--priority p1]` -- list tasks
    - `erledigen complete <id|text>` -- complete a task
    - `erledigen delete <id|text>` -- delete a task
    - `erledigen someday add "learn Rust"` -- add to Someday
    - `erledigen someday list` -- list Someday tasks
    - `erledigen server start|stop|status` -- control the server process
    - All commands support `--format json|plain|csv` for output formatting
- [ ] **Interactive TUI mode:** Running `erledigen` with no arguments opens a terminal UI for navigating and managing tasks.
    - TUI mirrors the web keyboard shortcuts exactly (same shortcut table from v0.5.0).
    - Vim keys (`j`/`k`/`J`/`K`), `e`, `d`, `Space`, `n`, `?` all work identically.
- [ ] **Natural language parsing:** Dates (today, tomorrow, next monday), tags (`#work`), priority (`#p1`), all parsed from free text.
- [ ] **Full parity:** Everything the web UI can do, the CLI can do.

### Definition of Done
- All commands functional and tested.
- TUI mode navigable with keyboard; shortcuts match web UI.
- Natural language parsing reliable.
- `--format` flag working for json/plain/csv output.

---

## v2.1.0: MCP Server

Adds an MCP (Model Context Protocol) server in `packages/mcp` enabling AI-assisted task management.

**Design principle: No AI in the UI.** The web UI, CLI command mode, and TUI contain zero AI features. AI automation is exclusively available via this MCP server and the CLI. This keeps the UI fast, deterministic, and distraction-free.

- [ ] **Package setup:** `packages/mcp` exposing all Erledigen capabilities as MCP tools.
- [ ] **Core tools:** create/update/delete tasks, query tasks by date/tag/priority, manage Someday groups, manage projects, manage routines.
- [ ] **AI workflow support** (MCP-only -- not in the web UI):
    - **AI scheduling:** "Schedule all my `#work` tasks for next week" -- AI distributes tasks across days.
    - **Daily briefing:** "What do I have today?" -- summarizes tasks, overdue, streaks.
    - **Batch creation:** "Create a project with these 10 tasks: ..." -- AI creates project + tasks at once.
    - **Smart triage:** "Which overdue tasks should I reschedule vs drop?" -- AI helps decide.

### Documentation & ADRs
- ADR: No AI in the UI -- all AI automation via MCP and CLI only.

### Definition of Done
- All MCP tools implemented and documented.
- AI scheduling and briefing workflows functional.

---

## v2.2.0: Notifications

Adds browser push and email reminders.

- [ ] **Per-task reminders:** `reminder: { time: string; channels: ('push' | 'email')[] }` field (stubbed in v0.2.0) is now live.
- [ ] **Browser push notifications:** Web Push API; user grants permission on first use.
- [ ] **Email reminders:** Configurable email provider via `EmailAdapter` interface (SMTP / Resend / Postmark). Selected and configured in Settings.
- [ ] **App-wide defaults:** Default reminder time and channels configurable in Settings.
- [ ] **Notification management:** View, edit, and cancel scheduled reminders.

### Technical Notes & Considerations
- `EmailAdapter` interface in `packages/shared`; adapters for SMTP, Resend, Postmark implement it.
- `send-reminder` jobs scheduled via `JobQueue` (see [ADR-002](../docs/devs/architecture/decisions/ADR-002-sqlite-backed-job-queue.md)). Job dispatches at the configured reminder time.
- Background job (cron) on the server checks for upcoming reminders and dispatches them.

### Definition of Done
- Push and email reminders deliver reliably.
- Per-task and app-wide defaults work correctly.
- `EmailAdapter` interface documented for custom implementations.

---

## v2.3.0: Authentication

Adds multi-user support with passwordless authentication.

- [ ] **Passwordless auth:** Passkey (WebAuthn) as the primary method; magic link via email as fallback.
- [ ] **User accounts:** Registration, login, logout. Sessions managed with short-lived JWTs (15 min) + refresh tokens (30 days).
- [ ] **Data scoping:** All tasks, projects, groups, settings, and `UserPreferences` are scoped per user.
- [ ] **Protected API:** All endpoints require a valid JWT. Middleware enforces data isolation.
- [ ] **PostgreSQL adapter:** Add a PostgreSQL persistence adapter to support multi-user at scale. Same repository interfaces as SQLite (see [ADR-001](../docs/devs/architecture/decisions/ADR-001-sqlite-raw-sql-persistence.md)), different SQL implementations in `migrations/postgresql/`.

### Security Requirements
- Passkeys stored per FIDO2 spec. No password is ever stored.
- Magic links: short-lived (15 min), single-use, HTTPS-only.
- JWTs stored in httpOnly, Secure, SameSite=Strict cookies -- not localStorage.
- Refresh token rotation: a new refresh token is issued on every use; old token invalidated.
- CSRF protection via SameSite cookie + custom header check.

### Privacy / Data Minimization
- Only store what auth requires: email (for magic links), passkey credentials, session tokens.
- No real name, no phone number, no profile picture.
- Account deletion purges all user data immediately (tasks, settings, tokens).
- GDPR-ready from day one.

### Definition of Done
- Passkey and magic link login working.
- All data correctly scoped per user.
- JWT + refresh token flow with rotation working.
- PostgreSQL adapter tested and production-ready.
- Data deletion tested end-to-end.

---

## v2.4.0: Security Hardening

A dedicated security audit and hardening release. Runs before SaaS billing to ensure the platform is secure before accepting payment and managing multiple users' data.

- [ ] **OWASP Top 10 audit:** Systematic review of all endpoints against the OWASP Top 10. Findings documented and remediated.
- [ ] **Dependency scanning:** `osv-scanner` (or equivalent) integrated into CI. Zero known-vulnerable dependencies in production.
- [ ] **Secrets scanning:** `git-secrets` or `trufflehog` pre-commit hook and CI check. Historical git scan on first run.
- [ ] **CSP hardening:** Content Security Policy tightened to the minimum required set of directives. Subresource integrity on all external assets.
- [ ] **Audit logging:** All write operations logged with user ID, timestamp, and action. Uses structured JSON logging (see [ADR-004](../docs/devs/architecture/decisions/ADR-004-structured-json-logging.md)). Audit logs stored separately from application data, queryable via Loki (see [ADR-006](../docs/devs/architecture/decisions/ADR-006-observability-stack.md)).
- [ ] **Brute-force protection:** Account lockout after N failed auth attempts. Rate limiting on auth endpoints (stricter than general API rate limit).
- [ ] **CORS:** Locked down to explicit origin allowlist in production. Wildcard `*` never used.
- [ ] **Threat model document:** Written and stored in `docs/security/threat-model.md`. Covers trust boundaries, attack surfaces, and mitigations.

### Documentation & ADRs
- ADR: threat model and key security decisions (session storage, token lifetimes, CORS policy).
- Dev docs: security model overview, how to run the dependency scanner, how to interpret audit logs.

### Definition of Done
- OWASP Top 10 audit complete; all high/critical findings remediated.
- Dependency scanner green in CI.
- Secrets scanner in pre-commit hook and CI.
- Audit logging functional.
- Threat model document written.

---

## v2.5.0: SaaS & Billing

Erledigen is open-source -- anyone can self-host for free. This release adds optional managed hosting with Stripe billing for users who prefer not to self-host.

- [ ] **Managed hosting:** Creator's instance available at a public URL. Onboarding flow: sign up -> choose plan -> Stripe Checkout -> access app.
- [ ] **`PaymentAdapter` interface** in `packages/server`. Stripe adapter implements it. Self-hosted deployments can swap in a no-op adapter.
- [ ] **`BILLING_ENABLED` env var:** Set to `false` on self-hosted instances to disable all billing code paths. Billing is completely inert when disabled.
- [ ] **Stripe integration:**
    - Stripe Checkout for subscription sign-up (monthly and yearly plans).
    - Stripe Customer Portal for plan changes, cancellation, and payment method management.
    - Webhook handling for subscription lifecycle: `created`, `updated`, `cancelled`, `payment_failed`.
    - Stripe webhook signature verification on all incoming events.
- [ ] **Free tier:** Defined limits (e.g., up to N tasks, no recurring tasks, no notifications). Paid tier: unlimited.
- [ ] **Billing UI** in Settings (visible on managed hosting only):
    - Current plan and renewal date.
    - Upgrade / downgrade / cancel flow (via Stripe Customer Portal redirect).
    - Invoice history.
- [ ] **Transactional email** (extends `EmailAdapter` from v2.2.0):
    - Magic link auth emails.
    - Subscription receipts and payment failure notices.
    - Plan change confirmations.

### Security Considerations
- Stripe webhook signature verified on every event.
- No card data ever touches our server -- all payment handling is Stripe-side.
- Subscription state is stored locally (plan, status, Stripe customer ID) -- nothing sensitive.

### Documentation & ADRs
- ADR: open-core model (open-source self-host + managed paid tier).
- ADR: Stripe as the payment provider.
- User docs: pricing and billing FAQ.
- Dev docs: how to disable billing for self-hosted deployments.

### Definition of Done
- Stripe Checkout and Customer Portal flows working end-to-end.
- Webhook lifecycle events handled correctly.
- Free tier limits enforced.
- `BILLING_ENABLED=false` completely disables billing with no side effects.
- Self-hosted Docker deployment unaffected by billing code.

---

## v2.6.0: Advanced Automation

- [ ] **2-Day Rule:** Priority rises over time for routines not completed. Non-recurring tasks roll over to the next day.
- [ ] **Smart scheduling (MCP-only):** AI-assisted task distribution -- suggests how to spread tasks based on capacity, deadlines, and priority. Available via MCP server; not surfaced in the web UI.
- [ ] **Conditional tasks:** Set conditions on tasks (e.g., "complete X to unlock Y").
- [ ] **Capacity planning:** Set a daily task limit; auto-distribution respects it.

---

## v2.7.0: Canvas LMS Integration

Pull assignments and due dates from a Canvas LMS instance into Erledigen.

- [ ] **`CanvasCalendarAdapter`** implementing the `ImportAdapter` interface.
- [ ] **Configuration** in Settings: Canvas instance URL + API token (stored encrypted in the database).
- [ ] **Sync behavior:** One-way pull only (Canvas -> Erledigen). Creates scheduled tasks from Canvas assignments: title, due date, course name as a tag (e.g. `#cs-101`).
- [ ] **Scheduled auto-sync:** Configurable interval (e.g., every hour, every day) or manual pull via a "Sync now" button in Settings.
- [ ] **Deduplication:** Canvas assignment ID stored on imported tasks. Re-syncing does not create duplicates.
- [ ] **Update handling:** If an assignment's due date changes in Canvas, the corresponding task's date is updated on next sync.

### Technical Notes & Considerations
- Canvas REST API is public and well-documented. OAuth or API token auth.
- Requires background job infrastructure (available from v2.x).
- User-scoped Canvas token storage requires auth (v2.3.0 prerequisite).

### Security Considerations
- Canvas API token stored encrypted (not plaintext) in the database.
- Token never logged or exposed in API responses.

### Definition of Done
- Canvas assignments imported with correct date, title, and course tag.
- Deduplication prevents double-imports.
- Auto-sync configurable and functional.
- Canvas token stored encrypted.