#!/usr/bin/env bash
# Cut a release through a pull request: gates -> version bump + changelog
# PR -> squash-merge -> annotated tag on the merge commit -> GitHub Release.
#
# main is branch-protected (PR + required CI, no direct pushes), so the
# release commit itself goes through a PR exactly like every other change.
# The annotated tag lands on the PR's squash-merge commit -- the commit
# main actually carries -- and the GitHub Release reuses the same notes
# (changelog.sh is the single notes generator).
#
# The repo has no npm publishing (all packages are private) -- a release
# is purely the version-bump commit, the tag, the CHANGELOG.md section,
# and the GitHub Release.
#
# Usage:
#   tools/release.sh [--full] [--yes] <major|minor|patch|X.Y.Z>
#
#   --full   also run the dockerized integration suite (api + e2e) and a
#            production build before the PR. Slow (10+ min on first image
#            build). Default gates: biome + types + unit tests.
#   --yes    do not ask before opening the PR and merging it
#
# Flow:
#   1. quality gates (CI's local mirror; --full adds the docker suites)
#   2. release/vX.Y.Z branch: update-version.sh bump + changelog.sh
#      --write (the CHANGELOG.md section rides the same PR)
#   3. open the PR; --auto merges once the required checks pass
#      (auto-merge needs the repo setting; otherwise the script watches
#      the checks and merges, and the ruleset is the final arbiter)
#   4. tag the squash-merge commit on main, push the tag
#   5. gh release create with the same notes
#   6. print the manual post-release steps (screenshots, dev-refresh)
#
# Rules:
#   * the working tree must be clean (no staged, unstaged, or untracked
#     files) -- release from a clean main, not from a dirty shared checkout
#   * must run on branch main, up to date with origin/main
#   * refuses to reuse an existing tag

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

FULL=0
ASSUME_YES=0
BUMP=""
while [ $# -gt 0 ]; do
    case "$1" in
        --full) FULL=1 ;;
        --yes | -y) ASSUME_YES=1 ;;
        -h | --help)
            sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) BUMP="$1" ;;
    esac
    shift
done

if [ -z "$BUMP" ]; then
    sed -n '2,32p' "$0" | sed 's/^# \{0,1\}//' >&2
    exit 1
fi

cd "$REPO_ROOT"

# -- preconditions ------------------------------------------------------------

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
    die "releases are cut from main (you are on '$BRANCH')"
fi

if [ -n "$(git status --porcelain)" ]; then
    die "working tree is not clean:
$(git status --porcelain | sed 's/^/    /')
commit or stash first -- a release PR must contain only the version bump"
fi

step "Syncing with origin"
git fetch origin --tags
if [ "$(git rev-parse main)" != "$(git rev-parse origin/main)" ]; then
    die "main is not up to date with origin/main -- pull (ff-only) first"
fi

# -- quality gates ------------------------------------------------------------

step "Gate: biome (CI mode)"
bun run check:ci

step "Gate: type-check"
bun run type-check

step "Gate: unit tests"
bun run test:unit

if [ "$FULL" = 1 ]; then
    step "Gate: dockerized api + e2e suite"
    "$TOOLS_DIR/test-stack.sh" all

    step "Gate: production build + bundle budget"
    "$TOOLS_DIR/build.sh"
fi

# -- version bump + changelog section -----------------------------------------

step "Bumping version ($BUMP)"
"$TOOLS_DIR/update-version.sh" "$BUMP"

NEW_VERSION="$(grep -m1 '"version"' package.json | sed 's/[^0-9.]*//g')"
TAG="v$NEW_VERSION"
BRANCH_NAME="release/$TAG"

if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
    die "tag $TAG already exists"
fi

PREV_TAG="$(git describe --tags --abbrev=0 2>/dev/null || true)"

if [ ! -f "$REPO_ROOT/CHANGELOG.md" ]; then
    die "CHANGELOG.md is missing -- every release prepends its section to
it (changelog.sh --write). Restore the file, then cut the release."
fi

step "Writing the CHANGELOG.md section ($TAG)"
# The bump commit is already in the range (it is HEAD), so the section
# covers everything since the previous tag, release commit included.
if [ -n "$PREV_TAG" ]; then
    "$TOOLS_DIR/changelog.sh" --write --title "$TAG" "$PREV_TAG" HEAD
else
    "$TOOLS_DIR/changelog.sh" --write --title "$TAG" HEAD
fi

if [ -n "$PREV_TAG" ]; then
    NOTES="$("$TOOLS_DIR/changelog.sh" --title "$TAG" "$PREV_TAG" HEAD)"
else
    NOTES="$("$TOOLS_DIR/changelog.sh" --title "$TAG" HEAD)"
fi

# -- release branch + PR ------------------------------------------------------

step "Creating release branch $BRANCH_NAME"
git switch -c "$BRANCH_NAME"

step "Creating release commit"
git add package.json bun.lock packages/shared/package.json \
    packages/server/package.json packages/client/package.json \
    packages/server/src/version.ts CHANGELOG.md
git commit -m "chore(release): $TAG"

if [ "$ASSUME_YES" != 1 ]; then
    printf 'Open the release PR for %s (and auto-merge when checks pass)? [y/N] ' "$TAG"
    read -r REPLY
    case "$REPLY" in
        y | Y | yes | YES) ;;
        *) die "aborted -- release branch $BRANCH_NAME is left in place" ;;
    esac
fi

step "Pushing $BRANCH_NAME and opening the PR"
git push -u origin "$BRANCH_NAME"
gh pr create --title "chore(release): $TAG" --body "Release $TAG.

The version bump, the stamped \`version.ts\`, and the new CHANGELOG.md
section ride this PR (main is branch-protected; releases land like every
other change). After merge, the annotated tag lands on the squash-merge
commit and the GitHub Release is created from the same notes.

Post-release manual steps (see tools/release.sh output):
- re-shoot \`docs/assets/screenshot.png\` + \`docs/assets/social-preview.png\`
  against the released app and open a small docs PR
- \`mise run dev-refresh\` if a dev stack is running pre-release images" \
    --base main

step "Merging when the required checks pass"
if gh pr merge "$BRANCH_NAME" --squash --delete-branch --auto >/dev/null 2>&1; then
    note "auto-merge enabled -- merging as soon as the checks pass"
else
    note "auto-merge is not enabled -- watching checks, then merging"
    gh pr checks "$BRANCH_NAME" --watch >/dev/null 2>&1 || true
    gh pr merge "$BRANCH_NAME" --squash --delete-branch
fi

# CI (e2e + api + build + storybook) takes minutes even when green --
# poll the PR state, not a fixed sleep. gh pr merge --delete-branch has
# removed the local release branch by now and left this checkout on main.
step "Waiting for the PR to merge (required checks run first)"
MERGED=0
for _ in $(seq 1 180); do # 180 x 10s = 30 minutes
    STATE="$(gh pr view "$BRANCH_NAME" --json state --jq .state 2>/dev/null || true)"
    if [ "$STATE" = "MERGED" ]; then
        MERGED=1
        break
    fi
    sleep 10
done
if [ "$MERGED" != 1 ]; then
    die "the release PR did not merge within 30 minutes -- resolve CI, merge
the PR yourself, then finish by hand:
    git fetch origin --tags
    git switch main && git merge --ff-only origin/main
    git tag -a $TAG <merge-sha> -m 'Release $TAG'
    git push origin $TAG
    gh release create $TAG --title $TAG --generate-notes"
fi

step "Fast-forwarding main to the release commit"
git fetch origin main
git merge --ff-only origin/main

MERGE_SHA="$(git rev-parse main)"
if ! git log -1 --format=%s main | grep -q "chore(release): $TAG"; then
    die "main's HEAD is not the $TAG release commit (got: $(git log -1 --format=%s main)) -- tag manually"
fi

# -- tag + GitHub Release ------------------------------------------------------

step "Creating annotated tag $TAG on the merge commit"
git tag -a "$TAG" "$MERGE_SHA" -m "Release $TAG" -m "$NOTES"
git push origin "$TAG"

step "Creating the GitHub Release"
NOTES_FILE="$(mktemp)"
printf '%s\n' "$NOTES" >"$NOTES_FILE"
gh release create "$TAG" --title "$TAG" --notes-file "$NOTES_FILE"
rm -f "$NOTES_FILE"

# -- done ---------------------------------------------------------------------

step "Done: $TAG released (tag $TAG on $MERGE_SHA, GitHub Release published)"
note "Commits in this release:"
echo "$NOTES"
note ""
note "Manual post-release steps:"
note "  1. Re-shoot docs/assets/screenshot.png and"
note "     docs/assets/social-preview.png against the released app, then"
note "     open a small docs PR with the new images (every release)."
note "  2. If a dev stack is running pre-release images: mise run dev-refresh."