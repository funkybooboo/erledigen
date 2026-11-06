#!/usr/bin/env bash
# Release notes, in two passes: DRAFT, then FINAL.
#
# The draft is generated from the commit log (conventional commits,
# grouped by type: breaking changes, feat, fix, perf, refactor, then
# everything else) -- raw material for writing, not the notes
# themselves. The final section is written by hand for the app's
# users and operators and passed with --notes-file: the body comes
# from the file, the header (title, date, compare link) stays
# generated. tools/release.sh requires it, and this script remains
# the single notes generator: the same section feeds CHANGELOG.md,
# the annotated tag, and the GitHub Release.
#
# Usage:
#   tools/changelog.sh                          latest tag..HEAD (the draft)
#   tools/changelog.sh <from> [<to>]            any refs (tags, shas, HEAD)
#   tools/changelog.sh --write [...]            prepend the section to CHANGELOG.md
#   tools/changelog.sh --notes-file <f> [...]   the body comes from <f> (the
#                                               hand-written final)
#   tools/changelog.sh --title <t> [...]        force the section title (used by
#                                               release.sh, which knows the
#                                               version before the tag exists)
#
# Examples:
#   tools/changelog.sh                          draft notes since the last tag
#   tools/changelog.sh v1.0.0 v1.1.0            notes for a released range
#   tools/changelog.sh --write                  prepend HEAD notes to CHANGELOG.md

set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

WRITE=0
TITLE_OVERRIDE=""
NOTES_FILE=""
REFS=()
while [ $# -gt 0 ]; do
    case "$1" in
        --write) WRITE=1 ;;
        --notes-file)
            shift
            NOTES_FILE="${1:?--notes-file needs a value}"
            ;;
        --title)
            shift
            TITLE_OVERRIDE="${1:?--title needs a value}"
            ;;
        -h | --help)
            sed -n '2,27p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *) REFS+=("$1") ;;
    esac
    shift
done

FROM="${REFS[0]:-}"
TO="${REFS[1]:-HEAD}"

# A ref that does not exist is almost certainly a typo -- fail loudly
# instead of emitting an empty changelog.
for ref in "$FROM" "$TO"; do
    if [ -n "$ref" ] && ! git -C "$REPO_ROOT" rev-parse --verify --quiet "$ref" >/dev/null; then
        die "no such ref: $ref"
    fi
done

if [ -z "$FROM" ]; then
    FROM="$(git -C "$REPO_ROOT" describe --tags --abbrev=0 2>/dev/null || true)"
    if [ -n "$FROM" ]; then
        note "No <from> given -- using latest tag: $FROM"
    else
        note "No tags exist yet -- generating from the start of history"
    fi
fi

# -- resolve title, date, compare link ----------------------------------------

TITLE="$(git -C "$REPO_ROOT" describe --tags --exact-match "$TO" 2>/dev/null || true)"
if [ -n "$TITLE_OVERRIDE" ]; then
    # release.sh knows the version before any tag exists -- it passes the
    # title explicitly and the section is dated today. UTC, like the tag
    # and the GitHub Release it is about to create: a local-timezone
    # date can land a day off (v0.10.1 shipped tagged Oct 7 UTC but
    # its CHANGELOG section said Oct 6).
    TITLE="$TITLE_OVERRIDE"
    DATE="$(date -u +%Y-%m-%d)"
elif [ -z "$TITLE" ]; then
    TITLE="Unreleased"
    DATE="$(date -u +%Y-%m-%d)"
else
    DATE="$(git -C "$REPO_ROOT" log -1 --format=%as "$TO")"
fi

REMOTE="$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null || true)"
REMOTE="${REMOTE#git@github.com:}"
REMOTE="${REMOTE#https://github.com/}"
REMOTE="${REMOTE%.git}"
COMPARE=""
if [ -n "$FROM" ] && [ -n "$REMOTE" ]; then
    # A --title section outlives HEAD: release.sh writes it before the tag
    # exists, so point its compare link at the tag being cut -- the durable
    # CHANGELOG entry must not carry a link that rots with the next commit.
    TO_REF="$TO"
    if [ -n "$TITLE_OVERRIDE" ]; then
        TO_REF="$TITLE_OVERRIDE"
    fi
    COMPARE="https://github.com/$REMOTE/compare/$FROM...$TO_REF"
fi

# -- generate the markdown -----------------------------------------------------

if [ -n "$FROM" ]; then
    LOG_RANGE="$FROM..$TO"
else
    LOG_RANGE="$TO"
fi

BODY=""
if [ -n "$NOTES_FILE" ]; then
    if [ ! -s "$NOTES_FILE" ]; then
        die "notes file is missing or empty: $NOTES_FILE"
    fi
    BODY="$(cat "$NOTES_FILE")"
else
    RAW="$(git -C "$REPO_ROOT" log --no-merges --format='%s' "$LOG_RANGE")"
    if [ -z "$RAW" ]; then
        die "no commits in range $LOG_RANGE"
    fi

    BODY="$(printf '%s\n' "$RAW" | bun -e '
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const lines = Buffer.concat(chunks).toString().split("\n").filter(Boolean);

const parse = (subject) => {
    const m = subject.match(/^([a-z]+)(?:\(([^)]+)\))?(!)?:\s+(.*)$/);
    if (!m) return { type: null, scope: null, breaking: /BREAKING CHANGE/i.test(subject), subject };
    return {
        type: m[1],
        scope: m[2] || null,
        breaking: m[3] === "!" || /BREAKING CHANGE/i.test(subject),
        subject: m[4],
    };
};

const commits = lines.map(parse);
const used = new Set();
const emit = (title, group) => {
    const fresh = group.filter((c) => !used.has(c));
    if (fresh.length === 0) return "";
    for (const c of fresh) used.add(c);
    const items = fresh
        .map((c) => (c.scope ? `- **${c.scope}:** ${c.subject}` : `- ${c.subject}`))
        .join("\n");
    return `### ${title}\n\n${items}\n\n`;
};

let out = "";
out += emit("Breaking changes", commits.filter((c) => c.breaking));
out += emit("Features", commits.filter((c) => c.type === "feat"));
out += emit("Fixes", commits.filter((c) => c.type === "fix"));
out += emit("Performance", commits.filter((c) => c.type === "perf"));
out += emit("Refactoring", commits.filter((c) => c.type === "refactor"));
out += emit("Everything else", commits);
console.log(out.trimEnd());
')"
fi

if [ -n "$COMPARE" ]; then
    HEADER="## [$TITLE]($COMPARE) - $DATE"
else
    HEADER="## $TITLE - $DATE"
fi

SECTION="$HEADER

$BODY"

# -- emit or write -------------------------------------------------------------

if [ "$WRITE" = 1 ]; then
    CHANGELOG="$REPO_ROOT/CHANGELOG.md"
    if [ -f "$CHANGELOG" ] && grep -qF "$HEADER" "$CHANGELOG"; then
        step "Section already present in CHANGELOG.md -- nothing to do"
        exit 0
    fi
    if [ ! -f "$CHANGELOG" ]; then
        printf '%s\n\n%s\n' "# Changelog" "What shipped, written for the app's users and operators -- not the
commit log. Each section is drafted from the commit log by
tools/changelog.sh, written by hand at release time, and shipped
verbatim as the GitHub Release; the story trail lives in
plans/history.md." >"$CHANGELOG"
    fi
    # Insert below the header block (the H1 plus its voice note) and
    # above the first '## [' section; a changelog with no sections yet
    # appends. ENVIRON carries the section raw -- awk -v would eat
    # backslash escapes in it.
    TMP="$(mktemp)"
    SECTION="$SECTION" awk '
        function emit_section() {
            n = split(ENVIRON["SECTION"], lines, "\n")
            for (i = 1; i <= n; i++) print lines[i]
        }
        !inserted && /^## \[/ { emit_section(); print ""; inserted = 1 }
        { print }
        END { if (!inserted) { print ""; emit_section() } }
    ' "$CHANGELOG" >"$TMP"
    mv "$TMP" "$CHANGELOG"
    step "CHANGELOG.md updated"
    note "$HEADER"
else
    printf '%s\n' "$SECTION"
fi