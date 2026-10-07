# USE-41: Canvas assignments in my calendar

As an app user who studies on Canvas LMS, I want assignments and due
dates pulled into erledigen as tasks, so that coursework lives with
everything else.

**Status**: planned
**Version**: v2.7.0

## Acceptance criteria
- [ ] CanvasCalendarAdapter (ImportAdapter interface): one-way pull
      (Canvas -> erledigen); title, due date, course tag
- [ ] Configured in Settings (instance URL + token, stored encrypted)
- [ ] Auto-sync on a schedule or manual "Sync now"
- [ ] Deduplication by Canvas assignment ID; date updates flow
      through on re-sync

## Notes

Needs auth (v2.3.0) for per-user token storage.