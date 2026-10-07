# Contributing to Erledigen

This is a personal project, published openly. You are welcome to hack on it --
if you want to change something, open an issue first so we agree it belongs
in the app before you spend time on it.

## Getting set up

Start with the [Getting Started guide](./docs/devs/process/getting-started.md) -- it covers tooling (mise, bun, docker) and how to run the app and the test suites. The client runs at `http://localhost:3000`, the server at `http://localhost:4000`.

## How we work

*   Read the [code standards](./docs/devs/standards/code-standards.md) and the [testing standards](./docs/devs/standards/testing.md) before writing code -- both record traps that have shipped real bugs.
*   Conventional Commits, short-lived branches, squash-merged pull requests: see the [git workflow](./docs/devs/standards/git-workflow.md).
*   Architecture decisions are immutable ADRs: see the [architecture doc](./docs/devs/architecture/architecture.md).

## Pull requests

1.  Create a branch named `<type>/<description-in-kebab-case>` (e.g. `feature/task-filtering`, `docs/api-notes`).
2.  Make your change, with tests. Match the existing code style.
3.  Run `mise run ci` locally before pushing -- it mirrors the CI pipeline (lint, format check, spellcheck, link check, type-check, unit tests, build budget).
4.  Open a pull request against `main` and keep it focused: one logical change per PR.

Bug reports and feature ideas are welcome as issues -- a good bug report includes reproduction steps and what you expected to happen.