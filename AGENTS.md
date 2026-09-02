# AGENTS.md

Erledigen: self-hosted task app (daily list + Someday panel + habits).
Monorepo: `packages/shared` (types, utils, errors, adapter interfaces used by
both sides), `packages/server` (Bun HTTP + WS, adapter pattern, DI container),
`packages/client` (SvelteKit, Svelte 5 runes). Human docs:
[README.md](README.md), [docs/devs/README.md](docs/devs/README.md).

## Read before you build

- Conventions and testing: `docs/devs/standards/`
- Architecture and ADRs: `docs/devs/architecture/` (ADRs are immutable; a
  new decision gets a new ADR)
- How everything runs: `mise.toml` is the source of truth; `tests/README.md`
  covers the three test layers

The skills in `.agents/skills/` hold what is NOT written in any doc: the
traps and quirks that past bugs paid for. Load the relevant one before
working in that area.

| Skill | What it saves you from |
|-------|----------------------|
| `svelte-traps` | Svelte 5 / SvelteKit gotchas, each of which caused a real bug here |
| `bun-traps` | Bun process wrappers, `bun build` and `.sql`, sqlite-vs-memory divergence, regex pathology |
| `env-traps` | Port ownership, dockerized stacks, playwright env, flake triage, this-machine quirks |
| `repo-quirks` | Surprising domain facts: priority-is-a-tag, date key strings, habit idempotency, double origin-skip, hidden CI gates |
| `git-concurrent-sessions` | Committing safely while another session has WIP staged |

## Must-know before touching anything

- Another agent session often works here concurrently. If `git status` is
  not clean, read `git-concurrent-sessions` BEFORE any git operation.
- Ports 3000/4000 belong to the live docker dev stack. `predev`,
  `pretest:e2e*`, and `mise run ci` KILL whatever holds those ports without
  asking -- never run them while someone's dev stack is up.
- Bun is the package manager, runtime, and test runner; never use
  npm/yarn/pnpm.
- Fast local gates: `bun run check:ci`, `bun run type-check`,
  `bun run test:unit`. `mise run ci` is the full mirror and is disruptive
  (kills ports, spawns servers, builds Storybook).

Load a skill with `/skill:<name>` (pi) or read
`.agents/skills/<name>/SKILL.md` (any harness).