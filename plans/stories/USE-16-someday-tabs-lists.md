# USE-16: Someday becomes tabs and lists

As an app user, I want the Someday panel to hold tabs of lists, so
that my unscheduled ideas park in named places that are not tied to
dates.

**Status**: done (v0.16.0)
**Version**: v0.16.0

## Acceptance criteria
- [x] Tabs hold lists (replacing tag-based groups); default: one
      tab + one list, both "Someday", no title shown
- [x] Lists are not tied to a date; tasks parked in them are undated
      backlog
- [x] Auto-tab: creating a project creates its someday tab with
      "+ add list" ready
- [x] Plain lists carry no tag of their own; a project tab's lists
      inherit the project's tag (the someday-group tag field dies)
- [x] Sub-tasks nest under their parents in the new surfaces too
- [x] The panel keeps its name: the Someday panel

## Notes

ADR-011. The drawer-vs-modal question is settled (2026-11-06,
the user's call): the Someday area stays the right-hand drawer --
tabs run across the top of the panel, lists nest under them. A modal
would bury the capture net behind a keystroke and would put the
task's one home (rule 1) inside a lens. The export snapshot carries
the restructure as version 2 (ADR-026).

As built (v0.16.0):

- The Someday surface keeps the drawer, the resize handle, and the
  collapse behavior; the panel header lost its "Someday" title and
  the lone default tab carries no label (the story's "no title
  shown").
- Data model: `SomedayTab` (with an optional `projectTag` -- the
  join key) and `SomedayList`; `Task.someDayGroupId` became
  `somedayListId`. The someday-group tag and description fields
  died; old groups become lists under the default tab via
  migration 013 and the v1-snapshot forward mapping, ids preserved.
- Every install owns a default tab (fixed id `default`): the API
  rejects deleting it and a restore re-seeds it when the snapshot
  lacks it. Dateless tasks with no list render in its implicit
  Unlisted section, so parked work is never invisible. The default
  list is deletable data, not an invariant.
- Tag inheritance is creation-time: tasks created in a project
  tab's lists get the tag appended to their text (typed words and
  manual controls never disagree), and the inline tag parser now
  reads interior colons so `#project:x` is one tag -- its doc
  comment finally true.