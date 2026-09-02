---
name: concurrent-git
description: Safe git in the Erledigen repo while another agent session has work in progress -- the stash trap, the commit --only sweep and temp-index behavior, purity checks, the staged-file surgery recipe, and commit conventions. Use before ANY stateful git operation when the tree or index is not clean.
---

# Concurrent-Session Git Safety

The user frequently runs MULTIPLE agent sessions in this repo at once. If
`git status` shows work that is not yours, these rules apply. Always check
first; the tree is often clean and none of this is needed.

## Absolute rules

1. NEVER `git stash` while another session has STAGED work. `git stash pop`
   flattens staged to unstaged and the index state is lost. Recovery if it
   already happened: find the dangling stash commit with
   `git fsck --no-reflogs`; its SECOND parent is the index commit;
   `git read-tree <index-commit>` restores the exact staged state (verify no
   git processes are running first).
2. `git commit --only <paths>` commits the worktree content of those paths,
   through a TEMP index so pre-commit hooks only see the listed files (other
   files' staged WIP is preserved and untouched by hooks). TRAP: any UNSTAGED
   changes inside those paths get swept into your commit.
3. `git checkout HEAD -- <file>` destroys the file's staged index entry. To
   reset a worktree file to HEAD while preserving someone's staged content:
   `git show HEAD:<file> > <file>`.
4. After any surgical commit, verify purity with
   `git show HEAD -- <file> | grep -E '^\+[^+]'`: every added line must be
   yours.

## Staged-file surgery (commit your removals/changes when a file also holds
another session's WIP)

    1. cp full worktree copies of the file(s) to /tmp backup.
    2. git show HEAD:<file> > <file>           # worktree := HEAD
    3. re-apply ONLY your changes to the file.
    4. git commit --only -m "<conventional message>" -- <paths>
       (this also updates the real-index entries for those paths)
    5. cp /tmp backups back                    # worktree := their WIP + your changes
    6. git add <paths>                         # restores their staged entry vs new HEAD

This keeps their WIP alive in the worktree AND in the index, while your
change lands pure; when they later commit, it does not resurrect what you
removed.

## Untracked-dependency trap

Code can depend on untracked files (e.g. a new migration `.sql`). Committing
the code without the migration breaks every other checkout and the docker
build; `git add` untracked dependencies together with the code that needs
them.

## Conventions (enforced)

- Conventional Commits via commitlint: feat, fix, docs, style, refactor,
  perf, test, build, ci, chore, revert. Lowercase subject, no trailing
  period, never empty.
- Pre-commit runs lint-staged (biome check --write and cspell on staged
  files) plus gitleaks `protect --staged`; secret-looking staged strings
  abort the commit.
- Work lands on main with a linear history; do not create merge commits.
- Never commit secrets or `.env` files.