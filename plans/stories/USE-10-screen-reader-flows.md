# USE-10: The app works through a screen reader

As an app user who is blind or low-vision, I want the core flows
(add, complete, navigate, search, modals) to work through NVDA and
VoiceOver, so that the day list is mine too.

**Status**: planned
**Version**: v0.12.0

## Acceptance criteria
- [ ] Manual NVDA (Windows) + VoiceOver (macOS) passes on: add task,
      complete task, navigate the day list, open search
- [ ] Modals: focus trapped, Esc returns focus to the trigger
- [ ] ADR: WCAG 2.1 AA as the standard

## Notes

ARIA roles, focus management, and the skip link already shipped
(history.md); this is the human-audited half.
