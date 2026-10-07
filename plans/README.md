# Plans

How work is planned, prioritized, and tracked. The rule (ADR-017):
**nothing is done that does not make one of three roles better** -- the
app user, the operator, and the developer.

## The pieces

| Path | What it is |
|------|------------|
| [identity.md](./identity.md) | The product constitution: the identity + the eleven system rules (immutable; ADR-010 / ADR-014) |
| [roadmap.md](./roadmap.md) | The queue: where we stand + versions, each version carrying its stories |
| [stories/](./stories/) | One file per user story, named by role + number |
| [history.md](./history.md) | The verbatim record of every shipped version |
| [issues.md](./issues.md) | Raw self-audit notes -- story input, kept verbatim |

## Story IDs

The prefix names the role the story serves (and matches the
documentation homes, ADR-020):

- **USE-nn** -- the app user (docs in `docs/use/`)
- **HOST-nn** -- the operator (docs in `docs/host/`)
- **BUILD-nn** -- the developer (docs in `docs/build/`)

A story file carries the story ("As a ..., I want ..., so that ..."),
its acceptance criteria, its status (planned / doing / done), its
planned version, and links to the ADRs behind it.

## The workflow

1. Work is proposed as a story file (or a change to one).
2. The roadmap queues it into a version; versions release in numeric
   order (release process: `tools/release.sh`).
3. Every commit cites its story in a `Story: <ID>` footer
   (commitlint-enforced); every PR states it too.
4. When the version ships, its stories flip to done; the shipped
   record lands in history.md and the CHANGELOG.

## Conventions

- Numeric order: always complete the lowest incomplete version before
  starting anything higher (the deliberate exceptions -- polish runs
  last -- are recorded in the roadmap).
- Pre-1.0 allows one deliberate breaking pass per concept; after
  v1.0.0, breaking changes need a new major version.
- ADRs are the record for decisions; stories are the record for
  demand. If a "why" question has no ADR, write one; if a "for whom"
  question has no story, write one before building.