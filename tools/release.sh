#!/usr/bin/env bash
# Cut a release: run quality gates, bump the version everywhere, commit, tag.
#
# The repo has no npm publishing (all packages are private) -- a release is
# purely a version-bump commit plus an annotated tag. The tag message gets
# the commit log since the previous tag, which doubles as release notes.
#
# Usage:
#   tools/release.sh [--full] [--push] <major|minor|patch|X.Y.Z>
#
#   --full   also run the dockerized integration suite (api + e2e) and a
#            production build before tagging. Slow (10+ min on first image
#            build). Default gates: biome + types + unit tests.
#   --push   push the release commit and tag to origin after tagging.
#
# Rules:
#   * the working tree must be clean (no staged, unstaged, or untracked
#     files) -- release from a clean main, not from a dirty shared checkout
#   * must run on branch main
#   * refuses to reuse an existing tag

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

FULL=0
PUSH=0
BUMP=""
for arg in "$@"; do
    case "$arg" in
        --full) FULL=1 ;;
        --push) PUSH=1 ;;
        -h | --help)
            sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) BUMP="$arg" ;;
    esac
done

if [ -z "$BUMP" ]; then
    sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//' >&2
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
commit or stash first -- a release commit must contain only the version bump"
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

# -- version bump -------------------------------------------------------------

step "Bumping version ($BUMP)"
"$TOOLS_DIR/update-version.sh" "$BUMP"

NEW_VERSION="$(grep -m1 '"version"' package.json | sed 's/[^0-9.]*//g')"
TAG="v$NEW_VERSION"

if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
    die "tag $TAG already exists"
fi

# -- commit + tag -------------------------------------------------------------

step "Creating release commit"
git add package.json bun.lock packages/shared/package.json \
    packages/server/package.json packages/client/package.json
git commit -m "chore(release): $TAG"

step "Creating annotated tag $TAG"
# changelog.sh is the single notes generator (also used for CHANGELOG.md)
PREV_TAG="$(git describe --tags --abbrev=0 2>/dev/null || true)"
if [ -n "$PREV_TAG" ]; then
    NOTES="$("$TOOLS_DIR/changelog.sh" "$PREV_TAG" HEAD)"
else
    NOTES="$("$TOOLS_DIR/changelog.sh" HEAD)"
fi
git tag -a "$TAG" -m "Release $TAG" -m "$NOTES"

# -- push or instruct ----------------------------------------------------------

if [ "$PUSH" = 1 ]; then
    step "Pushing release commit and tag to origin"
    git push origin main
    git push origin "$TAG"
else
    step "Release $TAG created locally"
    note "Push it when ready:"
    note "    git push origin main && git push origin $TAG"
fi

step "Done: $TAG"
note "Commits in this release:"
echo "$NOTES"
