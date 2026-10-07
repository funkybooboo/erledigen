# USE-27: Sections are heading tasks

As an app user, I want a task whose text starts with "# " (for
example "# Morning") to render as a section header inside the day,
with its own inline add beneath it, so that I can structure a day the
way a paper calendar does.

**Status**: planned
**Version**: v0.17.0

## Acceptance criteria
- [ ] "# Morning"-style tasks render as section headers in the day
      list (same syntax as the v0.10.0 live-markdown titles)
- [ ] Sections carry their own inline add beneath them
- [ ] Sections and tasks are one manual sequence; a task belongs to
      the section above it by position
- [ ] No collision with tagging: tags are #word with no space

## Notes

ADR-013; grounds the in-day sections the v0.10.0 title renderer
prepared.