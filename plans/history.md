# History: shipped versions

The verbatim record of every shipped release -- what was planned, what
as-built notes say, the decisions made. The living queue lives in
[roadmap.md](./roadmap.md); the product constitution in
[identity.md](./identity.md).

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
- [x] **SQLite Adapter:** Implement a file-based SQLite adapter as the first real persistence layer (see [ADR-001](../docs/build/architecture/decisions/ADR-001-sqlite-raw-sql-persistence.md)).
    - Zero-config for self-hosted use: single `.db` file on disk (`./data/erledigen.db`, configurable via `DB_PATH`).
    - Raw SQL via `bun:sqlite` -- no ORM (see [ADR-001](../docs/build/architecture/decisions/ADR-001-sqlite-raw-sql-persistence.md)).
    - JSON columns for `tags[]`, `reminder`, nested objects -- repository handles `JSON.parse`/`JSON.stringify` at the boundary.
    - Schema migrations via raw SQL files (see [ADR-003](../docs/build/architecture/decisions/ADR-003-raw-sql-migrations.md)): sequentially-numbered `.sql` files, forward-only, lightweight runner (~50 LOC).
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
- [x] **JSON log format:** Upgrade `ConsoleLogger` to emit structured JSON when `LOG_FORMAT=json` (production default), human-readable text when `LOG_FORMAT=text` (development default) (see [ADR-004](../docs/build/architecture/decisions/ADR-004-structured-json-logging.md)).
- [x] **Request ID middleware:** Generate a `requestId` (UUID) per HTTP request. Attach to all logs in that request's scope via child logger pattern. Return as `X-Request-Id` response header.
- [x] **Request duration logging:** Log method, path, status code, and duration in ms for every HTTP request.
- [x] **Job-scoped logging:** Background jobs log with `jobId` and `jobType` in context.
- [x] **Child logger pattern:** `RequestLogger` wraps parent logger with default context (request ID, job ID). Services receive child loggers -- they don't manage correlation IDs.
- [x] **Error logging:** Errors always include `error.message` and `error.stack` in structured context.

### Metrics
- [x] **`MetricsAdapter` interface** in `packages/shared/src/adapters/metrics/` (see [ADR-005](../docs/build/architecture/decisions/ADR-005-prometheus-metrics.md)).
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
- [x] **JSON** -- canonical format; lossless round-trip. All entities included (see [ADR-008](../docs/build/architecture/decisions/ADR-008-export-format-stability.md)).
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
- SQLite via `bun:sqlite` (built into Bun -- no extra dependency). No ORM -- raw SQL per [ADR-001](../docs/build/architecture/decisions/ADR-001-sqlite-raw-sql-persistence.md).
- Migrations are forward-only raw SQL files per [ADR-003](../docs/build/architecture/decisions/ADR-003-raw-sql-migrations.md). No `down()` migrations -- fix-forward is the policy.
- Keep PostgreSQL adapter for v2.3.0 when multi-user auth is added. Same repository interfaces, different SQL implementations.
- The JSON export format is documented and stable -- users can rely on it for backups.
- Import UI: a file picker in Settings > Import/Export with format selection and column mapping for CSV.
- All import adapters are tested with real export files from the source apps.
- `Logger` interface stays the same -- `ConsoleLogger` implementation gains JSON output. Child logger pattern adds context without changing the interface.
- OTEL SDK is deferred to v2.x (see [ADR-004](../docs/build/architecture/decisions/ADR-004-structured-json-logging.md)). The current `Logger` interface is OTEL-compatible.

### Documentation & ADRs
- [ADR-001](../docs/build/architecture/decisions/ADR-001-sqlite-raw-sql-persistence.md): SQLite with raw SQL (no ORM)
- [ADR-003](../docs/build/architecture/decisions/ADR-003-raw-sql-migrations.md): Raw SQL migration files (forward-only)
- [ADR-004](../docs/build/architecture/decisions/ADR-004-structured-json-logging.md): Structured JSON logging & request tracing
- [ADR-005](../docs/build/architecture/decisions/ADR-005-prometheus-metrics.md): Prometheus-compatible metrics endpoint
- [ADR-008](../docs/build/architecture/decisions/ADR-008-export-format-stability.md): export format stability commitment (JSON as canonical).
- [ADR-009](../docs/build/architecture/decisions/ADR-009-import-semantics.md): import semantics (destructive JSON restore, additive task imports, upsert-by-id rejected).
- User docs: export guide ([export.md](../docs/use/export.md)) and import guide ([import.md](../docs/use/import.md)).
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
- [x] **`JobQueue` interface** in `packages/server/src/adapters/jobs/` (see [ADR-002](../docs/build/architecture/decisions/ADR-002-sqlite-backed-job-queue.md)).
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
- Job queue is SQLite-backed per [ADR-002](../docs/build/architecture/decisions/ADR-002-sqlite-backed-job-queue.md). Same database, `jobs` table.
- `rrule.js` for recurring date generation.
- Streak calculation: check if yesterday's instance was completed when today's is completed.
- All automation logic has unit tests written before implementation.
- Job metrics are exposed via `/api/metrics` (see [ADR-005](../docs/build/architecture/decisions/ADR-005-prometheus-metrics.md)): `erledigen_jobs_total`, `erledigen_job_duration_seconds`, `erledigen_jobs_pending`, `erledigen_jobs_running`.

### Documentation & ADRs
- [ADR-002](../docs/build/architecture/decisions/ADR-002-sqlite-backed-job-queue.md): SQLite-backed job queue

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
  [ADR-015](../docs/build/architecture/decisions/ADR-015-safe-by-construction-markdown.md).)
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

## v0.10.1: Platform and roles

The platform milestone: the repo learns to serve all three roles --
app user, operator, developer -- instead of only the developer. The
license, the plans, the deployment substrate, and the docs each take
a role-shaped form.

**Status:** COMPLETE (2026-10-07, released as tag `v0.10.1`). Five
decisions preceded the build -- AGPL-3.0-only (ADR-016), stories as
the unit of work (ADR-017), the deployment architecture (ADR-018:
GHCR images, compose canonical, Helm for k8s), no tracking anywhere
(ADR-019), docs by role (ADR-020) -- and the whole arc shipped in
one day (PRs #44-#51).

- [x] **License clarity (BUILD-1):** AGPL-3.0-only -- the full
      LICENSE text, REUSE.toml SPDX declarations, the README badge
      and section, the package.json license field. Honest open
      source with network-use copyleft; dual licensing stays open to
      the sole author (ADR-016).
- [x] **Story-first plans (BUILD-2):** plans/ restructures into
      identity.md (the constitution), roadmap.md (the queue),
      history.md (this record), and one file per story in stories/
      with USE-/HOST-/BUILD- role prefixes; commitlint enforces a
      `Story: <ID>` footer on every commit (chore(release) exempt),
      and the PR template and role issue templates follow
      (ADR-017).
- [x] **Docs by role (USE-1):** docs/use (app users), docs/host
      (operators -- install, configuration, upgrade,
      backup/restore, monitoring), docs/build (developers), each
      with a README routing the role in; CONTRIBUTING.md stays at
      the repo root; the README points each role at its home
      (ADR-020).
- [x] **Install from published images (HOST-1):** publish-images.yml
      pushes erledigen-server and erledigen-client to GHCR on every
      release tag plus a floating `latest`; compose.prod.yaml pulls
      them, so the operator path starts with a pull, not a git
      clone.
- [x] **Kubernetes via Helm (HOST-2):** the in-repo chart
      (deploy/helm/erledigen) ships the server Deployment + PVC,
      the client Deployment, an Ingress routing /api and /ws to the
      server and / to the client, probes, and resource hints. The
      single-replica constraint is documented honestly: SQLite on a
      PVC, WebSocket in-process, jobs in-app -- scale-out is the
      v2.x architecture, not a values tweak (ADR-018).
- [x] **Graceful shutdown (HOST-3):** SIGTERM (and SIGINT) stops the
      job runner, stops accepting connections, drains in-flight
      requests, closes every WebSocket, closes SQLite, exits 0 --
      container restarts and rollouts never drop a request or tear
      a socket mid-write.
- [x] **Liveness + readiness (HOST-4):** /healthz answers "the
      process is alive" (cheap, no dependency checks), /readyz
      answers "dependencies reachable" (a SQLite SELECT 1; 503
      pauses traffic without restarting the process); both are
      registered in the OpenAPI so route parity enforces them, and
      the human-oriented /api/health stays untouched.
- [x] **The operator runbooks (HOST-5 through HOST-8):** docs/host
      carries the upgrade path (pull the new tag, restart,
      migrations apply at boot fail-fast, verify with /api/health),
      backup and restore (both layers: the SQLite volume and the
      ADR-008 JSON snapshot, with the pre-restore safety backup),
      the configuration reference (every env var, its default, what
      it does, and which container consumes it), and the monitoring
      hookup (a Prometheus scrape of /api/metrics, /healthz for
      uptime monitors, METRICS_ENABLED=false as the off switch).

### Technical Notes & Considerations

- The Helm chart deploys the server with a Recreate strategy:
  SQLite on a PVC cannot take two writers, so a rolling update
  would briefly stack two replicas against the same volume
  (ADR-018).
- Release mechanics grew with the milestone: tools/release.sh now
  cuts a release end to end through a PR -- bump every manifest and
  the CHANGELOG section, PR, auto-merge, tag the merge commit,
  GitHub Release -- and the tag fires publish-images.yml to GHCR.
  The first run tripped on `gh pr checks --watch` exiting instantly
  while checks were still unscheduled; the poll-until-verdict fix
  followed (PR #51).
- The trail, for the record: ADR-016..020 and the license swap
  (#44), plans as stories (#45), docs by role (#46), commitlint and
  templates (#47), the host platform (#48), close-out (#49), the
  release (#50).

### Definition of Done

- [x] All eleven v0.10.1 stories done: BUILD-1, BUILD-2, USE-1,
      HOST-1 through HOST-8.
- [x] Released as tag `v0.10.1` -- the first CHANGELOG section, and
      the first release cut end to end by the PR-based release.sh.
- [x] Every role has a home: the operator installs from a pull, the
      app user reads docs/use, the developer works story-first.

---


## v0.11.0: Theming and customization

The calendar gets its own look: theming moves out of Settings into
its dedicated Theme modal, accent schemes carry the brand through
the interface, tags get colors and a management screen, motion
becomes deliberate and reduced-motion-aware, and the remaining
preferences (sizes, toggles, shortcut remapping) ship. Plus the
privacy promise, in the user docs without a hedge.

**Status:** COMPLETE (2026-10-09, released as tag `v0.11.0`). All
seven stories shipped in one day (PRs #56-#64), closed out and
released through the standard close-out -> release.sh flow (#65,
#66).

- [x] **Theming is its own modal (USE-2):** the Theme modal joins
      the icon rail (palette icon, `g a`) ahead of Settings and
      takes over light/dark/system switching; Settings keeps only
      behavior -- time format and timezone stay there under a Time
      heading.
- [x] **Accent schemes drawn from the logo (USE-3):** blue (the
      shipped default), coral, and amber -- the latter two take
      their OKLCH hues from the logo's red and yellow pills --
      re-skin the accent token family through `[data-accent]` with
      light and dark variants; the choice is a new `accent` field on
      UserPreferences (migration 008) selectable in the Theme
      modal.
- [x] **Tags carry colors (USE-4):** an 8-color pastel palette
      (`--tag-*` tokens), auto-assignment of the least-used color
      (a shared pure helper, so both sides agree on the policy),
      per-tag overrides, and the `#p1`/`#p2`/`#p3` semantic pill
      tokens -- on task rows, filter surfaces, and the bottom bar.
      Colors ride `UserPreferences.tagColors` (migration 009).
- [x] **Tag management in one screen (USE-5):** Settings lists
      every tag with count and color; inline rename, merge into
      another tag, recolor through the palette picker, and removal
      via a new `POST /api/tags/delete` that strips the tag from
      every task (broadcasting `tag:deleted`). Tag operations
      rewrite tasks without per-task events, so the task store now
      refetches on every `tag:*` broadcast.
- [x] **Purposeful animations (USE-6):** a completion flash on the
      row, Svelte built-in transitions on the shared Modal (open
      AND close; scale on desktop, fly for the mobile sheet),
      alongside the existing panel-collapse and drag-ghost motion
      -- and `prefers-reduced-motion` respected everywhere through
      one CSS kill switch plus a JS-side gate
      (`lib/motion.ts`), including smooth scrolls downgraded to
      instant.
- [x] **The remaining preferences (USE-7):** text size and row
      spacing scale the day-list reading surfaces through
      `--fs-*`/`--row-*` tokens (Theme modal Size section); the
      completion flash gets an On/Off choice (Motion section);
      Settings gains empty-day visibility (DayList finally honors
      the long-persisted `showEmptyDays`, keeping today and
      navigation targets rendered), the filter fresh-start toggle,
      and full keyboard-shortcut remapping with conflict warnings
      (`shortcutOverrides`, migration 012; one live-registry
      resolution feeds the matcher, the help modal, and every
      tooltip).
- [x] **The privacy commitment, stated plainly (USE-8):**
      docs/use/privacy.md -- no analytics, no telemetry, no
      tracking, any deployment mode (ADR-019) -- linked from the
      docs index and the introduction.

### Technical Notes & Considerations

- The client bundle budget was raised twice, both times with
  measured data: +12 KiB for the theming build, then a final
  version-sized +36 KiB once the tag-management section (+13 KiB
  compiled) showed the stories' real cost. The 712 KiB ceiling is
  the v0.11.0 shape; it is re-evaluated at the v1.0.0 gate.
- Five UserPreferences fields joined the entity (accent, tagColors,
  fontSize, rowDensity, completionAnimation, persistActiveFilters,
  shortcutOverrides -- migrations 008-012, all NOT NULL with
  shipped-default values; pre-v0.11.0 snapshots restore to the
  defaults). Preference changes still carry no WS broadcast: other
  tabs learn them on reload (theme behaved this way before; the
  e2e suite documents it).
- The shortcut registry lives client-side (`keybindings.ts`); the
  server persists `shortcutOverrides` shape-validated and replays
  it verbatim. The live registry is derived in one place
  (`preferencesStore.shortcutRegistry`) -- deriving from a module
  variable was the build's recurring trap and shipped one real
  stale-render fix (the help modal).
- Known CI flake, unchanged: the responsive suite's Someday
  collapse click occasionally times out under parallel load and
  passes on rerun (seen in v0.10.1 and once here).

### Definition of Done

- [x] All seven v0.11.0 stories done: USE-2 through USE-8.
- [x] Released as tag `v0.11.0` -- the second CHANGELOG section,
      cut end to end by release.sh (one manual assist: the script's
      final local fast-forward step ran from the release branch and
      needed a checkout first).
- [x] The app looks like itself: the brand reads through the whole
      interface, the user controls the look and the keys, and the
      no-tracking promise is in writing.

---

## v0.12.0: Accessibility

The app becomes usable by everyone: every action reachable without
a mouse, the screen reader behaviors named and tested, contrast and
reduced motion held to a standard instead of a vibe, every form
labeled and every failure heard, and the whole thing guarded by an
automated audit in CI.

**Status:** COMPLETE (2026-10-09, released as tag `v0.12.0`). All
five stories shipped in one day (PRs #69-#73), closed out (#74) and
released through the standard close-out -> release.sh flow (#76 --
the #68 fast-forward fix worked end to end; no manual assist).

- [x] **Every action reachable without a mouse (USE-9):** the
      keyboard audit closed out -- hover-only actions (row actions,
      Someday group actions, sub-task delete) reveal on keyboard
      focus, project cards are real buttons instead of
      role="button" divs with buttons nested inside, Calendar day
      cells announce their full date with aria-current, the Someday
      groups container is the role="list" its list items required,
      modal bodies are keyboard focus stops, and stacked dialogs
      get unique title ids. The drag grips and panel resize stay
      pointer conveniences with keyboard equivalents (r/m editors,
      Ctrl+\ toggle, detail-modal date fields) -- the flows are
      documented for users in docs/use/keyboard.md.
- [x] **The app works through a screen reader (USE-10):** ADR-022
      names WCAG 2.1 Level AA the standard, with the layered CI
      enforcement and the manual NVDA/VoiceOver half recorded as
      required. role="application" leaves the app shell (browse
      mode reads the ordinary widgets fine). The protocol is
      docs/build/standards/accessibility.md; the machine-checkable
      behaviors are e2e-verified (tests/e2e/accessibility.spec.ts):
      the skip link is the first Tab stop, Tab never escapes a
      dialog, Esc returns focus to the trigger, completion and
      delete announce through the live regions. A real find along
      the way: the minimap's on-load scrollIntoView set Chrome's
      sequential focus-navigation starting point, hijacking the
      first Tab into mid-page -- fixed with scrollTop math.
- [x] **Contrast and reduced motion respected (USE-11):** the light
      theme regraded -- secondary ink 66% -> 50.8% OKLCH (holds
      4.5:1 on all five reading surfaces), accent and the status
      hues darkened against their own pastel tints and the today
      wash, muted ink retired from readable text (hints, meta,
      empty states, completed rows, markers), and tag/#p1-#p3 chip
      text derived from the hue mixed 55% into the ink token (one
      formula, both themes; the raw hues were 1.6-3.8:1 in light
      mode). contrast.test.ts parses app.css and enforces every
      text-bearing pair, both themes, all accent schemes. Reduced
      motion shipped with USE-6 and was verified, not rebuilt.
- [x] **Labeled forms, announced errors (USE-12):** the last
      placeholder-only inputs got accessible names (filter tag
      input, Projects create/edit, Someday group create/rename,
      task-text inline editor); the silent failure paths now
      announce (project create, group create/rename, habit save,
      all through the role=status notifications); the Settings
      timezone error mounts as its own role=alert while the
      valid-preview sibling stays unannounced.
- [x] **Accessibility regressions caught by CI (USE-13):**
      @axe-core/playwright (a dev dependency, never in the browser
      bundle) runs WCAG 2.1 A/AA tags over the page in BOTH themes,
      all 11 rail modals, the task detail, the Habits create form,
      the project detail board, the Someday add-group form, and
      stacked Settings + Confirm dialogs -- zero violations per
      run, enforced on every e2e execution.

### Technical Notes & Considerations

- Two audit-time traps cost real debugging time and are documented
  in the spec header: sampling mid-animation fabricates contrast
  failures (the 150ms modal transition at ~50% opacity -- every
  audit waits for all running animations via document.getAnimations()),
  and the rail buttons toggle their modals.
- The light theme darkening is visible: secondary ink and accent
  are a grade deeper than Fizzy's originals, set by the 4.5:1 line
  rather than taste. Chip hues keep their identity through the
  55%-into-ink mix.
- Two engine facts for test fixtures: Chromium's Intl accepts 'PST'
  where Bun rejects it (never use it as an invalid-timezone
  fixture), and the Settings form must wait for preferences to
  land or the sync effect clobbers a too-early fill.
- The .gitignore build/ rule was anchoring the docs/build/ directory
  by accident; the v0.12.0 fix anchored it to the repo root -- and
  had to re-ignore packages/client/build/ (the vite output) in a
  same-day follow-up (#75) after it tripped the release clean-tree
  rule.

### Definition of Done

- [x] All five v0.12.0 stories done: USE-9 through USE-13.
- [x] Released as tag `v0.12.0` -- the third CHANGELOG section, cut
      end to end by release.sh with the #68 fast-forward fix in
      place (no manual assist this time).
- [x] The gates hold the line: axe zero-violations, the contrast
      token test, svelte-check a11y warnings, and the documented
      manual protocol for the human half.

---
