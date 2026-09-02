# Shared helpers for the scripts in tools/. Source this file; never execute
# it directly.
#
# Every script that sources this gets:
#   REPO_ROOT  -- absolute path to the repo, regardless of the caller's cwd
#                (safe to invoke from anywhere, including other worktrees)
#   step/note/die -- logging helpers (all output is plain ASCII)

TOOLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$TOOLS_DIR/.." && pwd)"

# Section header.
step() {
    printf '==> %s\n' "$*"
}

# Indented detail line.
note() {
    printf '    %s\n' "$*"
}

# Fatal error: print message to stderr and exit 1.
die() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

# Run a command with the repo root as cwd.
from_root() {
    (cd "$REPO_ROOT" && "$@")
}
