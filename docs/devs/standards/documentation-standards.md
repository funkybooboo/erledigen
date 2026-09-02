# Documentation Standards

How documentation is written and organized in the Erledigen project.

## Philosophy

- **Plain text in Git** -- version controlled, reviewable, searchable with
  grep; no wikis or external tools
- **Plain ASCII** -- printable ASCII only (0x20-0x7E): no emoji, smart
  quotes, or box-drawing characters; use `--` for dashes and `->` for arrows
- **Dual perspective** -- user docs and dev docs, each for its own audience
- **Living documentation** -- updated in the same PR as the code it describes
- **Clarity over cleverness** -- simple, direct language; to the point

## Where Docs Live

```
docs/
|-- README.md              # documentation index
|-- devs/                  # developer documentation
|   |-- README.md          # dev docs index
|   |-- standards/         # code, testing, git, documentation standards + philosophy
|   |-- architecture/      # architecture.md + decisions/ (ADRs)
|   \-- process/           # getting-started, ci-cd-pipeline
\-- users/                 # end-user documentation (introduction, design)
plans/                     # roadmap and planning docs
tests/README.md            # how to run each test suite
```

Every document is exactly what its name says; if a fact lives in two places,
one of them is wrong. When a document stops being true, fix it or delete it.

## Writing Rules

- **One H1 per file**, ATX headers (`#`), no skipped levels.
- **Dash lists**, 2-space nesting; code blocks always name their language.
- **Soft line-length limit of 100 characters** (long URLs, tables, and code
  blocks exempt).
- Links must resolve -- `mise run check-links` (lychee) runs in CI.
- Spelling must pass `mise run spellcheck` (cspell; add project terms to
  `cspell.json`).
- Examples in docs must be real. Never document a feature, command, or file
  that does not exist in the repo.
- Dev docs state project-specific facts and traps, not generic tutorials --
  the internet already has those.

## Dual Perspective

A feature is documented from both sides when it needs it:

- **User docs** (`docs/users/`) -- what the feature does, how to use it,
  keyboard shortcuts, tips. Non-technical.
- **Dev docs** (`docs/devs/`) -- how it is implemented, why, the API, edge
  cases, and the traps. See [architecture.md](../architecture/architecture.md)
  for the current layout of this knowledge.

## ADRs

Significant architecture and product decisions are recorded as immutable
ADRs in `docs/devs/architecture/decisions/` (numbered sequentially, ADR-001,
ADR-002, ...). ADRs are never edited after acceptance -- a new decision gets
a new ADR. See that directory's README for the format and index.

## Documentation Architecture

This is a standing commitment across every release.

- **User docs**: Hosted on a Writebook instance. Covers getting started, all
  features, keyboard shortcuts, import/export, and customization. Linked
  from the bottom bar of the app.
- **Dev docs**: Architecture, standards, process, and ADRs -- this
  `docs/devs/` tree.
- **In-app help**: The `?` Help modal shows all keyboard shortcuts organized
  by category. Links at the bottom open the full Writebook docs.
- **Writebook link**: Bottom bar far-right corner -- a small "docs" link
  that opens the user docs home page.
