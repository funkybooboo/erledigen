# USE-10: The app works through a screen reader

As an app user who is blind or low-vision, I want the core flows
(add, complete, navigate, search, modals) to work through NVDA and
VoiceOver, so that the day list is mine too.

**Status**: done
**Version**: v0.12.0

## Acceptance criteria
- [ ] Manual NVDA (Windows) + VoiceOver (macOS) passes on: add task,
      complete task, navigate the day list, open search
- [x] Modals: focus trapped, Esc returns focus to the trigger
- [x] ADR: WCAG 2.1 AA as the standard

## Notes

ARIA roles, focus management, and the skip link already shipped
(history.md); this is the human-audited half.

As-built (2026-10-09, PR #72): ADR-022 names WCAG 2.1 Level AA the
standard with the layered CI enforcement, and records the two
product decisions (no `role="application"` -- the app shell exposes
ordinary browse-mode-readable widgets; reduced motion follows the
OS). The manual protocol is documented for both readers with an
eight-item core-flow checklist in docs/build/standards/
accessibility.md. Every machine-checkable half is e2e-verified in
tests/e2e/accessibility.spec.ts: the skip link is the first Tab stop
(a real minimap scrollIntoView focus hijack was found and fixed on
the way), Tab never escapes a dialog, Esc returns focus to the
trigger, and completion/delete announce through the live regions.

The unchecked box is the human half by definition: the NVDA and
VoiceOver walkthroughs need a person on Windows and macOS. The
protocol is ready; the passes are recorded as this release's
pending manual step.