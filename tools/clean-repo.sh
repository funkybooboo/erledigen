#!/usr/bin/env bash
# Remove every regenerable artifact from the working tree: node_modules,
# build outputs, tool caches, and test reports. Everything this script
# deletes is gitignored, so it is always safe to run.
#
# Usage:
#   tools/clean-repo.sh           clean everything
#   tools/clean-repo.sh -n        dry run: list what would be removed

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DRY_RUN=0
for arg in "$@"; do
    case "$arg" in
        -n | --dry-run) DRY_RUN=1 ;;
        -h | --help)
            sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) die "unknown argument: $arg (see --help)" ;;
    esac
done

# Regenerable directories, anywhere in the tree EXCEPT inside node_modules
# (node_modules itself is removed wholesale, so scrubbing its guts is
# pointless noise). Each match is pruned so find never descends into one
# (keeps nested node_modules and .vite caches inside deps out of the list).
DIRS=(
    node_modules
    dist
    build
    .svelte-kit
    .vite
    .biome-cache
    coverage
    test-results
    playwright-report
)

# Regenerable top-level paths that are not covered by the dir list above.
ROOT_PATHS=(storybook-static)

# Loose file patterns, anywhere in the tree.
FILE_GLOBS=('*.tsbuildinfo' '*storybook.log')

total_kb=0
removed=0

# Collect matches into an array first: skipping empty results keeps du from
# ever running argument-less (portable across GNU and BSD xargs/userlands)
# and keeps the dry-run listing clean.
find_dirs() {
    local -a matches=()
    # The node_modules exclusion must not apply when node_modules itself is
    # the target (the first -prune branch would swallow the match and
    # nothing would ever be collected).
    if [ "$1" = "node_modules" ]; then
        # shellcheck disable=SC2312
        while IFS= read -r -d '' path; do
            matches+=("$path")
        done < <(find "$REPO_ROOT" -type d -name node_modules -prune -print0 2>/dev/null)
    else
        while IFS= read -r -d '' path; do
            matches+=("$path")
        done < <(find "$REPO_ROOT" -name node_modules -prune -o -type d -name "$1" -prune -print0 2>/dev/null)
    fi
    FIND_DIRS=("${matches[@]}")
}

if [ "$DRY_RUN" = 1 ]; then
    step "Dry run -- listing what would be removed"
else
    step "Cleaning regenerable artifacts from $REPO_ROOT"
fi

for dir in "${DIRS[@]}"; do
    find_dirs "$dir"
    if [ "${#FIND_DIRS[@]}" -gt 0 ]; then
        kb="$(du -sk "${FIND_DIRS[@]}" | awk '{ s += $1 } END { print s + 0 }')"
        total_kb=$((total_kb + kb))
        if [ "$DRY_RUN" = 1 ]; then
            printf '%s\n' "${FIND_DIRS[@]}"
        else
            rm -rf "${FIND_DIRS[@]}"
        fi
        removed=$((removed + 1))
        note "$dir ($kb KB)"
    fi
done

for path in "${ROOT_PATHS[@]}"; do
    if [ -e "$REPO_ROOT/$path" ]; then
        kb="$(du -sk "$REPO_ROOT/$path" | cut -f1)"
        total_kb=$((total_kb + kb))
        note "$path ($kb KB)"
        [ "$DRY_RUN" = 1 ] || rm -rf "$REPO_ROOT/$path"
        removed=$((removed + 1))
    fi
done

ts_count="$(find "$REPO_ROOT" \( -name node_modules -o -name .git \) -prune -o -type f \( -name "${FILE_GLOBS[0]}" -o -name "${FILE_GLOBS[1]}" \) -print 2>/dev/null | wc -l)"
if [ "$ts_count" -gt 0 ]; then
    note "$ts_count loose file(s) matching: ${FILE_GLOBS[*]}"
    if [ "$DRY_RUN" = 1 ]; then
        find "$REPO_ROOT" \( -name node_modules -o -name .git \) -prune -o -type f \
            \( -name "${FILE_GLOBS[0]}" -o -name "${FILE_GLOBS[1]}" \) -print 2>/dev/null
    else
        find "$REPO_ROOT" \( -name node_modules -o -name .git \) -prune -o -type f \
            \( -name "${FILE_GLOBS[0]}" -o -name "${FILE_GLOBS[1]}" \) -delete
    fi
    removed=$((removed + 1))
fi

if [ "$removed" -eq 0 ]; then
    step "Nothing to clean -- tree is already clean"
elif [ "$DRY_RUN" = 1 ]; then
    step "Dry run complete: would free ~$((total_kb / 1024)) MB"
else
    step "Done: freed ~$((total_kb / 1024)) MB"
    note "Run 'mise run install' to restore dependencies"
fi
