# Erledigen 🕺

Welcome to Erledigen, a modern task application that's as fun to develop as it is to use! Inspired by the clean and simple interface of TeuxDeux, Erledigen is a unified task manager built around one idea: **you should only need one place to manage your work and your life**.

The daily list is the execution surface. Someday is the capture net. Projects and habits feed into the daily list automatically. Everything is organized with tags — the same tag system works across tasks, groups, Someday, and filters.

[![CI](https://github.com/funkybooboo/erledigen/actions/workflows/ci.yml/badge.svg)](https://github.com/funkybooboo/erledigen/actions/workflows/ci.yml)

---

## 🚀 What's Inside?

Erledigen is a **monorepo** built with a modern tech stack designed for a great developer experience:

*   **Frontend**: [SvelteKit](https://kit.svelte.dev/) + [Svelte 5 runes](https://svelte.dev/) + [Tailwind CSS v4](https://tailwindcss.com/) — a fast, modern, reactive UI.
*   **Backend**: [Bun](https://bun.sh/) — an incredibly fast JavaScript runtime, bundler, and package manager, all in one.
*   **Language**: [TypeScript](https://www.typescriptlang.org/) — end-to-end type safety.
*   **Real-time**: WebSocket sync — every mutation broadcasts to all connected clients instantly.
*   **API**: Schema-first [OpenAPI 3.1](https://www.openapis.org/) generated from Zod, served at `/openapi.yaml` and `/openapi.json`.
*   **Architecture**: [Adapter Pattern](./docs/devs/architecture/architecture.md) — a clean, modular architecture where every subsystem is behind an interface, so implementations can be swapped without touching application code.
*   **Code Quality**: [Biome](https://biomejs.dev/) — formatting and linting.
*   **Testing**: [Bun test](https://bun.sh/docs/cli/test) for units, [Playwright](https://playwright.dev/) for E2E, and [Bruno](https://www.usebruno.com/) for API tests.
*   **Components**: [Storybook](https://storybook.js.org/) — isolated component development and visual review.

## 🧩 Key Features

*   **Daily list** — the primary working area; a scrollable list of day sections with inline add/edit, drag-to-reorder, and drag between days.
*   **Someday panel** — a right-side capture net for unscheduled work, organized into tag-based groups.
*   **Tags as the primary organization** — `#p1`/`#p2`/`#p3` priority, `project:`-prefixed project tags, and any free-form tags. One filter system covers everything.
*   **Projects** — collections of ordered tasks with activate/deactivate and a detail view.
*   **Habits / recurring tasks** — templates that generate instances into the daily list, with streak tracking.
*   **Sub-tasks** — nested tasks under a parent; completion rolls up.
*   **Rollover** — incomplete tasks roll to the next day with `daysLate` tracking (configurable app-wide and per-task).
*   **Command palette** (`Cmd+K`) — fuzzy search across tasks plus a `/`-prefixed command mode (`/add`, `/go`, `/filter`, …).
*   **Keyboard-first** — full vim + arrow navigation; every action reachable without a mouse.
*   **Icon-rail modals** — Calendar, Summary, Projects, Habits, Search, Filter, Settings, Trash, Help.
*   **Trash with undo** — soft delete with 5s undo toast and auto-purge after 7 days.
*   **Privacy first** — no analytics, no telemetry, no tracking. Your data stays in your own database.

## ⚡️ Getting Started

This project uses [mise](https://mise.jdx.dev) as its task runner and tool version manager. Install it first, then:

1.  **Install dependencies**:

    ```bash
    mise run install
    ```

2.  **Run the development servers**:

    ```bash
    mise run dev
    ```

That's it! The client runs at `http://localhost:3000` and the server at `http://localhost:4000`.

### Common tasks

| Command | What it does |
|---------|--------------|
| `mise run dev` | Start client + server in parallel |
| `mise run client` / `mise run server` | Start just one |
| `mise run storybook` | Start Storybook on port 6006 |
| `mise run check` | Lint + format with Biome (auto-fix) |
| `mise run type-check` | Type-check all packages |
| `mise run test` | Run all unit tests |
| `mise run test-e2e` | Run Playwright E2E tests |
| `mise run test-api` | Run Bruno API tests against a local server |
| `mise run build` | Build all packages |
| `mise run ci` | Run the full local CI mirror |
| `mise run clean` | Remove build artifacts and caches |

## 📦 Monorepo Layout

```
erledigen/
├── packages/
│   ├── client/   # SvelteKit frontend (Tailwind CSS, Svelte 5 runes)
│   ├── server/   # Bun REST API + WebSocket server
│   └── shared/   # Types, adapter interfaces, constants, universal utilities
├── docs/         # User + developer documentation, ADRs
├── tests/        # Playwright E2E + Bruno API test suites
├── plans/        # Roadmap and planning docs
└── package.json
```

## 📚 Learn More

*   [**Introduction**](./docs/users/introduction.md) — a brief introduction to the project.
*   [**Product Design**](./docs/users/design.md) — the full product vision, data model, and feature set.
*   [**Getting Started**](./docs/devs/process/getting-started.md) — detailed setup and run instructions.
*   [**Architecture**](./docs/devs/architecture/architecture.md) — overview of the project's architecture.
*   [**Code Standards**](./docs/devs/standards/code-standards.md) — writing clean, consistent, maintainable code.
*   [**Testing**](./docs/devs/standards/testing.md) — testing strategies and tools.
*   [**Git Workflow**](./docs/devs/standards/git-workflow.md) — how we work with git and pull requests.
*   [**Roadmap**](./plans/roadmap.md) — release-by-release development plan.

## 🤝 Contribute

We'd love for you to join us! Whether you're a seasoned developer or just starting out, there are many ways to contribute to Erledigen. Check out our [**Getting Started**](./docs/devs/process/getting-started.md) guide to learn more.

---

Happy coding!
