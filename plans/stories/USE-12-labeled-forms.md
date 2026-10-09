# USE-12: Labeled forms, announced errors

As an app user with assistive technology, I want every input labeled
and every error announced, so that forms read correctly and failures
are heard, not just shown.

**Status**: done
**Version**: v0.12.0

## Acceptance criteria
- [x] Every input has an associated label
- [x] Error states announced via aria-live

## Notes

Follows from the shipped ARIA baseline (history.md).

As-built (2026-10-09, PR #70): the baseline was strong (labeled
Settings/Habits/TaskDetail forms, aria-live notification container);
the audit closed the rest. The last placeholder-only inputs got
accessible names (filter tag input, the four Projects create/edit
inputs, Someday group create/rename, the task-text inline editor).
The silent failure paths now announce: project creation, group
create/rename (rename no longer swallows failed updates), habit
save -- all through the role=status notifications -- and the
Settings timezone error mounts as its own role=alert span while the
valid-preview sibling stays unannounced. e2e covers the
reschedule-parse failure landing in the live region and the
timezone alert (appearance, aria-invalid, clearing). Two engine
findings worth keeping: Chromium's Intl accepts 'PST' where Bun
rejects it (never use it as an invalid-zone fixture), and the
Settings form must wait for preferences to land or the sync effect
clobbers a too-early fill.