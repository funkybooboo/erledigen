# USE-38: Reminders that reach me

As an app user, I want per-task reminders through browser push or
email, so that time-sensitive work reaches me outside the app.

**Status**: planned
**Version**: v2.1.0

## Acceptance criteria
- [ ] Per-task reminders: time + channels (push, email)
- [ ] Web Push permission flow; email via the pluggable EmailAdapter
      (SMTP / Resend / Postmark), configured in Settings
- [ ] App-wide default reminder time + channels
- [ ] Scheduled via the JobQueue (ADR-002); reminders viewable,
      editable, cancellable

## Notes

The task model's reminder field (stubbed since v0.2.0) goes live.