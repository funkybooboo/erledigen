# USE-20: One word for every repeat: routines

As an app user, I want "habit" and "recurring task" replaced by ONE
word everywhere -- routines -- so that there is nothing to unlearn
and one noun covers every repeat I live with.

**Status**: planned
**Version**: v0.17.0

## Acceptance criteria
- [ ] Full rename, one deliberate breaking pass (pre-1.0): entity
      RecurringTask -> Routine; routes /api/recurring-tasks ->
      /api/routines; task field recurringTaskId -> routineId; WS
      recurringTask:generated -> routine:generated; Habits modal ->
      Routines modal; "Make recurring" -> "Make routine"
- [ ] Storage migration: recurring_tasks -> routines,
      recurring_task_stats -> routine_stats,
      tasks.recurring_task_id -> tasks.routine_id
- [ ] Export snapshot v2 (ADR-008's version-2 clause): routines +
      routineId; restore accepts BOTH v1 and v2 so existing backups
      keep working

## Notes

ADR-012. The routines concept: any repeat you live with -- "water the
plants every mon and wed at 8am", "pay rent monthly", "study every
weekday until the exam".