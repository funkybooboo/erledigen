# BUILD-5: The MCP server

As a developer using AI tooling, I want an MCP server in packages/mcp
exposing erledigen as tools, so that AI assistants can manage tasks on
my behalf -- outside the UI.

**Status**: planned
**Version**: v2.1.0

## Acceptance criteria
- [ ] packages/mcp exposing the capabilities as MCP tools:
      create/update/delete/query tasks, lists, projects, routines
- [ ] AI workflow support (MCP-only, never the UI): scheduling a
      backlog across days, daily briefings, batch creation, triage
      suggestions
- [ ] ADR: "No AI in the UI" -- all AI automation via MCP and CLI

## Notes

ADR-014's boundary made concrete: the web UI stays fast,
deterministic, and distraction-free; the AI lives next door.