# Changelog

## [v0.12.0](https://github.com/funkybooboo/erledigen/compare/v0.11.0...HEAD) - 2026-10-09

### Features

- **client:** no mouse-only interactions remain (#71)
- **client:** every input labeled, every failure announced (#70)
- **client:** AA contrast for the light theme and tag chips (#69)

### Fixes

- **build:** keep ignoring the vite build output (#75)
- **tools:** release.sh returns to main before fast-forwarding (#68)

### Everything else

- **plans:** v0.12.0 close-out -- stories done, docs catch up (#74)
- **a11y:** axe-core in CI, zero violations per run (#73)
- **a11y:** WCAG 2.1 AA is the standard, with the manual protocol (#72)
- **plans:** v0.11.0 moves to history -- v0.12.0 is next (#67)

## [v0.11.0](https://github.com/funkybooboo/erledigen/compare/v0.10.1...HEAD) - 2026-10-09

### Features

- **keyboard:** custom shortcut remapping with conflict warnings (#63)
- **prefs:** empty-day visibility and the filter fresh start (#62)
- **prefs:** font size, row density, and the completion flash (#61)
- **client:** purposeful animations, reduced motion respected everywhere (#60)
- **tags:** manage tags in one screen (#59)
- **tags:** tags carry colors (#58)
- **prefs:** accent schemes drawn from the logo (#57)
- **client:** theming gets its own modal on the icon rail (#56)

### Fixes

- **tools:** changelog.sh stamps release sections in UTC (#54)
- **tools:** release.sh waits for check verdicts before merging (#51)

### Everything else

- **plans:** v0.11.0 close-out -- stories done, docs catch up (#65)
- **use:** the privacy commitment, stated plainly (#64)
- refresh the app screenshots for the v0.10.1 era (#55)
- **plans:** v0.10.1 moves to history -- v0.11.0 is next (#53)
- **adr:** the CLI is the automation surface -- no MCP server (ADR-021) (#52)

## [v0.10.1](https://github.com/funkybooboo/erledigen/compare/v0.10.0...HEAD) - 2026-10-06

### Features

- the host platform -- published images, Helm chart, graceful shutdown, probes (#48)
- **tools:** release.sh cuts releases through a PR end to end (#43)

### Fixes

- **server:** stamp day-note created/updated from one clock read (#40)

### Everything else

- **plans:** v0.10.1 close-out -- every story done (#49)
- **commitlint:** enforce the Story footer; PR + issue templates by role (#47)
- docs by role -- use, host, build (ADR-020) (#46)
- **plans:** the roadmap becomes user stories (ADR-017) (#45)
- **adr:** platform-era decisions (ADR-016..020) + AGPL-3.0-only relicensing (#44)
- repo-wide truth pass -- stale claims, missing features, voice (#41)
- manifest + lint hygiene -- tests join CI, one TS version, audit clean (#42)
- **plans:** two new UX-audit findings get their roadmap homes (#39)

Release notes, newest first. Every release appends its section here via
`tools/changelog.sh --write` (see `mise run changelog`).