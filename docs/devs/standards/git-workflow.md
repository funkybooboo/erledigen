# Git Workflow

Git workflow, branching, and commit standards for the Erledigen project.
Commit message format is **enforced** by the commitlint hook.

## Philosophy

- **Clean, linear history** -- easy to understand project evolution
- **Atomic commits** -- each commit is one logical change that passes tests
- **Meaningful commit messages** -- self-documenting history (Conventional Commits)
- **Worktree isolation** -- every feature and every parallel agent session
  gets its own `wt` worktree, never a shared checkout

## Branching: GitHub Flow + `wt` Worktrees

`main` is always deployable; everything else happens on short-lived branches
merged via pull request (squash-merge, then delete the branch).

**RULE**: features and parallel work happen in `wt` worktrees, merged to
`main` via pull request. `wt` (worktrunk) is installed on the dev machines
and manages one worktree per branch.

| Command | What it does |
|---------|---------------|
| `wt switch -c <branch>` | Create branch + worktree and switch into it |
| `wt switch -c -x pi <branch>` | Create and launch an AI agent inside it |
| `wt switch <branch>` / `wt switch -` (previous) / `wt switch ^` (main) | Hop between worktrees without disturbing them |
| `wt switch` | Interactive worktree picker |
| `wt list` | List worktrees and their status |
| `wt merge <target>` | Squash and fast-forward into target, remove the worktree |
| `wt remove` | Remove a worktree (deletes the branch when merged) |

The feature loop: `wt switch -c feature/x` -> develop with free commits in
your own worktree (rebase/amend freely -- nothing is shared) -> push the
branch -> open a PR -> squash-merge -> `wt remove`.

```bash
# 1. Create a feature worktree + branch and switch into it
wt switch -c feature/task-filtering

# 2. Make changes and commit
git add .
git commit -m "feat(client): add date range filter for tasks"

# 3. Push and open a PR on GitHub; address review feedback
git push -u origin feature/task-filtering

# 4. Squash-merge when approved, then clean up
wt remove
```

### Branch Naming

```
<type>/<description-in-kebab-case>
```

Types: `feature`, `bugfix`, `hotfix`, `refactor`, `docs`, `test`, `infra`,
`spike`. Lowercase, hyphens, no underscores: `feature/task-filtering-by-date`,
`bugfix/login-redirect-loop`, `docs/api-documentation-update`.

## Conventional Commits

**RULE**: all commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

- **Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
  `build`, `ci`, `chore`, `revert`
- **Scope** (optional): `server`, `client`, `shared`, `api`, `db`, `config`, ...
- **Breaking change**: `!` after the type, or a `BREAKING CHANGE:` footer
  describing the migration

```
feat(habits): add daysOfWeek schedule and streak stats

fix(api): prevent duplicate task creation on double-submit

docs: condense developer documentation
```

The description is lowercase, imperative, and specific -- "update stuff",
"fix bug", and "WIP" are rejected by commitlint and by review.

## Git Hooks

Hooks are managed with Husky and activate automatically on `bun install`.

- **`.husky/pre-commit`** -- fails fast on secrets (gitleaks over staged
  files), then runs `lint-staged` (Biome check --write + cspell on staged
  files). Repo-wide validation (`biome ci` + `tsc --noEmit`) runs in CI and
  via `bun run validate` before opening a PR -- it is not part of every
  commit.
- **`.husky/commit-msg`** -- validates the message against Conventional
  Commits via commitlint.

## Everyday Git

- **`git add -p`** to stage selective hunks -- keep commits atomic when the
  working tree holds several changes.
- **`git commit --amend`** to fix the last commit (message or forgotten
  files) -- only before pushing.
- **`git rebase -i HEAD~n`** to clean up WIP commits before opening a PR --
  only on branches nobody else has pulled.
- **Sync with main**: `git fetch origin && git rebase origin/main`, then
  `git push --force-with-lease` (only to your own feature branch).
- **Undo the last commit before pushing**: `git reset --soft HEAD~1` (keep
  changes) or `git reset --hard HEAD~1` (discard).
- **Lost a commit?** `git reflog` has it.

## Pull Requests

- Title follows Conventional Commits (`feat(habits): ...`).
- Keep PRs small (rule of thumb: under 400 changed lines) and link them to
  issues (`Closes #123`).
- The description covers what and why, the testing done, and any migration
  or deployment notes; screenshots for UI changes.
- All CI checks must pass; review comments must be resolved before merging.

## Appendix: Sharing a Single Checkout

**RULE**: Do not share a checkout -- use `wt` worktrees (above). This appendix
applies only when multiple agents/sessions end up in ONE checkout with each
other's work-in-progress in the tree or index. Every rule below was learned
the hard way.

1. **NEVER `git stash` while another session has STAGED work.** `git stash
   pop` flattens staged to unstaged and the index state is lost. Recovery if
   it already happened: find the dangling stash commit with
   `git fsck --no-reflogs`; its SECOND parent is the index commit;
   `git read-tree <index-commit>` restores the exact staged state (verify no git
   processes are running first).
2. **`git commit --only <paths>` commits the WORKTREE content of those paths**
   through a temp index (pre-commit hooks see only the listed files, and
   other files' staged WIP is preserved). TRAP: any UNSTAGED changes inside
   those paths get swept into your commit -- the classic way foreign WIP
   leaks into a "pure" commit.
3. **`git checkout HEAD -- <file>` destroys the file's staged index entry.** To
   reset a worktree file to HEAD while preserving someone's staged content:
   `git show HEAD:<file> > <file>`.
4. **Verify purity after any surgical commit:**
   `git show HEAD -- <file> | grep -E '^\+[^+]'` -- every added line must be yours.

### Staged-file surgery

Committing your changes to a file that also holds another session's WIP
(a plain `commit --only` would sweep their WIP, and their later commit would
resurrect whatever you removed):

```bash
# 1. Back up the full worktree copies of the file(s)
cp <file> /tmp/<file>.bak

# 2. Reset the worktree file to HEAD, KEEPING their staged entry
git show HEAD:<file> > <file>

# 3. Re-apply ONLY your changes to the file

# 4. Commit only those paths
#    (this also updates the real-index entries for the committed paths)
git commit --only -m "<conventional message>" -- <paths>

# 5. Restore the backup (worktree := their WIP + your changes)
cp /tmp/<file>.bak <file>

# 6. Restore their staged entry against the new HEAD
git add <paths>
```

Their WIP stays alive in worktree AND index while your change lands pure;
when they commit, it does not resurrect what you removed.

### More traps

- **Untracked dependencies**: code can depend on untracked files (a new
  migration `.sql` is the classic). Committing the code without the
  dependency breaks every other checkout and the docker build; `git add`
  untracked dependencies together with the code that needs them.
- **Vanish races**: if your files seem to vanish mid-session, re-check disk
  state before assuming data loss -- a concurrent git operation raced you.
  And after concurrent git activity, grep for your key additions: a
  concurrent commit can land a file version missing your verified lines.
