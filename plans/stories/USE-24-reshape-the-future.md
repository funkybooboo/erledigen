# USE-24: Schedule edits reshape the future, never the past

As an app user, I want editing a routine's schedule to offer deleting
uncompleted future instances and regenerating them on the new schedule,
so that my history stays exactly what happened and my future matches
what I now intend.

**Status**: planned
**Version**: v0.17.0

## Acceptance criteria
- [ ] Editing a schedule offers to reshape future instances
      (completed history is never touched)
- [ ] Until date: generation stops past it; an "ended" state shows
- [ ] Pause/resume: same semantics, manual and reversible
- [ ] History stays immutable (system rule 9)

## Notes

ADR-012, ADR-013. Generation is idempotent and client-driven (v0.8.0
decision stands -- no queued generation job).