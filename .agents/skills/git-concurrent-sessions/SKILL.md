---
name: git-concurrent-sessions
description: Safe git in the Erledigen repo while another agent session has work in progress -- the git stash trap that loses the index, commit --only sweeping unstaged foreign lines through a temp index, checkout HEAD destroying staged entries, purity verification, and the staged-file surgery recipe. Use before ANY stateful git operation when the tree or index is not clean.
---

# Git With Concurrent Sessions

The user frequently runs MULTIPLE agent sessions in this repo at once. If
`git status` shows work that is not yours, these rules apply (check first;
the tree is often clean and none of this is needed).

## Absolute rules

1. NEVER `git stash` while another session has STAGED work. `git stash pop`
   flattens staged to unstaged and the index state is lost. Recovery if it
   already happened: find the dangling stash commit with
   `git fsck --no-reflogs`; its SECOND parent is the index commit;
   `git read-tree <index-commit>` restores the exact staged state (verify
   no git processes are running first).
2. `git commit --only <paths>` commits the WORKTREE content of those paths,
   through a TEMP index, so pre-commit hooks only see the listed files
   (other files' staged WIP is preserved and untouched by hooks). TRAP: any
   UNSTAGED changes inside those paths get swept into your commit -- the
   classic way foreign WIP leaks into a "pure" commit.
3. `git checkout HEAD -- <file>` destroys the file's staged index entry. To
   reset a worktree file to HEAD while preserving someone's staged content:
   `git show HEAD:<file> > <file>`.
4. After any surgical commit, verify purity with
   `git show HEAD -- <file> | grep -E '^\+[^+]'`: every added line must be
   yours.

## Staged-file surgery

Committing your changes to a file that ALSO holds another session's WIP
(plain commit --only would sweep their WIP, and their later commit would
resurrect whatever you removed):

    1. cp full worktree copies of the file(s) to /tmp backup.
    2. git show HEAD:<file> > <file>          # worktree := HEAD
    3. re-apply ONLY your changes to the file.
    4. git commit --only -m "<conventional message>" -- <paths>
       (this also updates the real-index entries for those paths)
    5. cp /tmp backups back                   # worktree := their WIP + your changes
    6. git add <paths>                        # restores their staged entry vs new HEAD

Their WIP stays alive in worktree AND index while your change lands pure;
when they commit, it does not resurrect what you removed.

## More concurrent-session traps

- Untracked dependencies: code can depend on untracked files (a new
  migration `.sql` is the classic). Committing the code without the
  dependency breaks every other checkout and the docker build; `git add`
  untracked dependencies together with the code that needs them.
- If your files seem to vanish mid-session, re-check disk state before
  assuming data loss -- a concurrent git operation raced you.
- After concurrent git activity, grep for your key additions: a concurrent
  commit can land a file version missing your already-verified lines.
- Conventions enforced by hooks: Conventional Commits (commitlint), and
  pre-commit runs lint-staged (biome + cspell on staged files) plus gitleaks
  `protect --staged`; secret-looking staged strings abort the commit.