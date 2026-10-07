# ADR-017: User Stories Are the Unit of Work

**Status**: Accepted
**Date**: 2026-10-07

## Context

Erledigen now serves three roles, and all three are users of the repo:
the **app user** (works in the daily list), the **operator** (runs an
instance), and the **developer** (extends the code). The working rule
is strict: nothing is done that does not make one of these roles
better -- nothing more, nothing less.

The old roadmap was a feature plan per release version. It tracked
*what* would be built but not *for whom* and *why*. Two risks follow:
platform work (docs, deployment, process) looks like it has no home,
and product work can drift into building for the builder.

## Decision

1. **Story IDs carry the role**: `USE-nn` (app user), `HOST-nn`
   (operator), `BUILD-nn` (developer). The prefixes match the
   documentation role verbs (ADR-020) on purpose -- one vocabulary
   across plans and docs.
2. **One file per story** in `plans/stories/`
   (`HOST-1-run-on-kubernetes.md`). A story file carries: the story
   ("As an operator, I want X, so that Y"), acceptance criteria,
   status, its planned version, and links to ADRs.
3. **Versions remain the release cadence**: `plans/roadmap.md` stays a
   single file tying story IDs to versions (versions as folders were
   rejected -- they imply doc trees nobody maintains). The identity and
   the eleven system rules move to `plans/identity.md`; shipped
   versions move to `plans/history.md`.
4. **The linkage is enforced**: every commit carries a
   `Story: <ID>[, <ID>]` footer (commitlint-enforced;
   `chore(release)` is the only exempt type), and every PR states the
   story it fulfills.

## Rationale

Stories force the "for whom, why" question at the moment work is
planned, not reviewed. Keeping versions as containers preserves the
release discipline the repo already has (release.sh, CHANGELOG,
where-we-stand) while making every roadmap line traceable to a role.
Enforcement in commitlint makes the principle mechanically true rather
than aspirational.

## Consequences

- Commitlint gains a footer rule; a PR template gains a story field.
- Story files are maintained alongside code; their status flips
  (planned -> doing -> done) as work lands.
- `plans/issues.md` (the raw UX-audit notes) is story *input* and
  stays verbatim; findings live on in their story files.
- The roadmap file shrinks to the queue: where we stand, versions,
  story IDs per version.