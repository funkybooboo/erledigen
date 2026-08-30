# @erledigen/client

The SvelteKit frontend for Erledigen. Runs on port 3000 and talks to the server at port 4000 over HTTP and WebSocket.

Built with Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`), Tailwind CSS v4, and the adapter pattern — all data access goes through `@erledigen/shared` interfaces, so the real server can be swapped for a mock without touching components.

## Quick Start

```bash
mise run client
```

The client is available at `http://localhost:3000`. To run both client and server together:

```bash
mise run dev
```

## Layout

```
src/
├── lib/
│   ├── adapters/      # Config provider (Vite env), HTTP client impl
│   ├── components/    # BottomBar, DayList, DaySection, TaskRow, IconRail, Modal, …
│   │   └── modals/    # Calendar, Summary, Projects, Habits, Search, Filter, Settings, Trash, Help, TaskDetail
│   ├── services/     # Thin HTTP services per resource (task, project, recurring, someday, tag, preferences, websocket)
│   ├── stores/       # Svelte 5 $state stores (task, preferences, project, recurring, someday, tag, connection, notification, ui, dateView)
│   └── stories/      # Storybook mock data
├── routes/           # SvelteKit routes (+layout, +page)
└── app.html
```

## Scripts

| Script | What it does |
|--------|--------------|
| `bun run dev` | Vite dev server |
| `bun run build` | Production build |
| `bun run type-check` | `svelte-kit sync` + `tsc --noEmit` |
| `bun run test` | Unit tests via `bun test` |
| `bun run storybook` / `build-storybook` | Run / build Storybook |

## Learn More

See [Architecture](../../docs/devs/architecture/architecture.md) for how the client fits into the broader system.
