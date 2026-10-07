# Changelog

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