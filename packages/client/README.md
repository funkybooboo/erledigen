# @erledigen/client

The SvelteKit frontend for Erledigen. Runs on port 3000 and talks to the server at port 4000 over HTTP and WebSocket.

Built with Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`), hand-written scoped CSS over OKLCH design tokens (no utility framework), and the adapter pattern -- all data access goes through `@erledigen/shared` interfaces, so the real server can be swapped for a mock without touching components.

## Quick Start

```bash
docker compose up client   # dev container (or: bun run --cwd packages/client dev)
```

The client is available at `http://localhost:3000`. To run both client and server together:

```bash
mise run dev
```

## Layout

```
src/
|-- lib/
|   |-- adapters/      # Config provider (Vite env)
|   |-- components/    # BottomBar, DayList, DaySection, SectionHeader, TaskRow,
|   |                  #   IconRail, DateMinimap (month minimap), SomedayPanel,
|   |                  #   InlineAddTask, Modal, ModalHost, NotificationContainer,
|   |                  #   DayNoteField, LiveMarkdownEditor, HabitHeatmap,
|   |                  #   HabitScheduleForm, KanbanBoard, RecurrenceHint, Logo
|   |   \-- modals/    # Calendar, Summary, Projects, Habits, Notes, Search,
|   |                  #   Filter, Settings, Trash, Help, TaskDetail, Confirm
|   |-- services/      # Thin HTTP services per resource (task, project, recurring,
|   |                  #   someday, tag, holiday, day note, preferences, import,
|   |                  #   export, websocket)
|   |-- stores/        # Svelte 5 $state stores (task, preferences, project,
|   |                  #   recurring, someday, tag, holiday, day note, drag,
|   |                  #   connection, notification, ui, dateView)
|   |-- keybindings.ts    # Single shortcut registry -- drives the Help modal AND hover tooltips
|   |-- tooltip.ts        # `use:tooltip` Svelte action (label + keybinding chips)
|   |-- createFromText.ts # Shared inline-add / `/add` parsing (tasks + natural-language habits)
|   |-- filters.ts     # Tag/priority filtering + view composition
|   |-- liveLines.ts   # Live-editor line operations (split/merge/list continuation)
|   |-- dragReorder.ts # Day-list drag planning (with nndZone.ts drop zones)
|   \-- stories/       # Storybook mock data
|-- routes/            # SvelteKit routes (+layout with global keybindings, +page)
\-- app.html
```

## Scripts

| Script | What it does |
|--------|--------------|
| `bun run dev` | Vite dev server |
| `bun run build` | Production build |
| `bun run type-check` | `svelte-kit sync` + `tsc --noEmit` |
| `bun run check:svelte` | `svelte-check` (a11y, unused CSS, runes misuse) |
| `bun run test` | Unit tests via `bun test` |
| `bun run storybook` / `build-storybook` | Run / build Storybook |

## Learn More

See [Architecture](../../docs/devs/architecture/architecture.md) for how the client fits into the broader system.