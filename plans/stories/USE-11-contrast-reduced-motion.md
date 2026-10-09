# USE-11: Contrast and reduced motion respected

As an app user with low vision or motion sensitivity, I want AA
contrast in both themes and full reduced-motion support, so that
the app never excludes me.

**Status**: done
**Version**: v0.12.0

## Acceptance criteria
- [x] 4.5:1 contrast (normal text), 3:1 (large text), both themes
- [x] prefers-reduced-motion disables/minimizes all animation
      (shared criteria with USE-6)

## Notes

Ties to USE-6 (animations) and the OKLCH token system.

As-built (2026-10-09, PR #69): the light theme was where every
failure lived -- secondary ink darkened to a grade holding 4.5:1 on
all five reading surfaces (66% -> 50.8% OKLCH L), accent and the
status hues regraded against their own pastel tints and the today
wash, and muted ink retired from readable text (hints, meta, empty
states, completed rows, markers, the day-note affordance) -- it
stays for placeholders and decorative icons only. Tag and priority
chips derive text color from the hue mixed 55% into the ink token
(the raw hues were 1.6-3.8:1 in light mode). The dark theme needed
no token changes. Every pair is enforced by
packages/client/src/lib/contrast.test.ts, which parses app.css and
asserts both themes and all three accent schemes. Reduced motion
shipped with USE-6 (v0.11.0) -- the CSS kill switch plus the
motion.ts JS gate covering smooth scrolls; verified, not rebuilt.