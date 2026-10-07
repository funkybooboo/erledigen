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

Docs are organized by role (ADR-020) -- the same three roles the
story IDs carry (ADR-017):

```
docs/
|-- README.md              # role router: use, host, build
|-- use/                   # app users (introduction, design, notes, export, import)
|-- host/                  # operators (install, configuration, upgrade, backup, monitoring)
\-- build/                 # developers
    |-- README.md          # build docs index
    |-- standards/         # code, testing, git, documentation standards + philosophy
    |-- architecture/      # architecture.md + decisions/ (ADRs)
    \-- process/           # getting-started, ci-cd-pipeline
plans/                     # the story system: roadmap, stories/, identity, history
tests/README.md            # how to run each test suite
```

Every document is exactly what its name says and names its role; if a
fact lives in two places, one of them is wrong. When a document stops
being true, fix it or delete it.

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

A feature is documented for each role it touches, in that role's home:

- **`docs/use/`** -- what the feature does, how to use it, keyboard
  shortcuts, tips. Non-technical.
- **`docs/host/`** -- what the feature means for running an instance
  (config, resources, upgrade/backup impact).
- **`docs/build/`** -- how it is implemented, why, the API, edge
  cases, and the traps. See [architecture.md](../architecture/architecture.md)
  for the current layout of this knowledge.

## ADRs

Significant architecture and product decisions are recorded as immutable
ADRs in `docs/build/architecture/decisions/` (numbered sequentially, ADR-001,
ADR-002, ...). ADRs are never edited after acceptance -- a new decision gets
a new ADR. See that directory's README for the format and index.
