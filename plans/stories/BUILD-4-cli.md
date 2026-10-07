# BUILD-4: The CLI

As a developer (or terminal-first user), I want a full CLI in
packages/cli that talks to the server over HTTP, so that tasks are
manageable from the shell and scripts.

**Status**: planned
**Version**: v2.0.0

## Acceptance criteria
- [ ] erledigen add / list / complete / delete / someday ... with the
      same natural-language parsing as the app
- [ ] Interactive TUI mode when run bare (mirrors the web shortcut
      table)
- [ ] --format json|plain|csv for scripting
- [ ] Full parity: everything the web UI does

## Notes

No AI in the UI (ADR-014) -- the CLI is one of the sanctioned
automation surfaces.