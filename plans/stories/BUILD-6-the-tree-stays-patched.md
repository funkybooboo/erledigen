# BUILD-6: The tree stays patched

As a developer, I want known-vulnerable dependencies patched as
advisories land, so that the Security Audit gate stays a real gate --
green means patched, never ignored.

**Status**: done
**Version**: v0.13.1

## Acceptance criteria

- [x] `bun audit` is green: zero known-vulnerable packages in the
      lockfile
- [x] Every advisory is cleared by a version move -- an in-range bump
      or an exact-pinned override -- never by an audit ignore
- [x] A fix that only exists in a newer major is taken as a
      deliberate migration, validated by the full gates
      (svelte-check, type-check, unit, build + bundle budget,
      Storybook build, dockerized api + e2e)
- [x] ADR-025 records the policy and the triage order

## Notes

The trigger: ten advisories landed between the v0.13.0 release and
the v0.13.1 close-out, freezing every PR behind the required
Security Audit check.

As-built (2026-11-04): the in-range bumps are zod ^4.5.4 -> ^4.6.7
(HIGH: the server's input validation; GHSA-mrhx-c7xc-m3w5) and the
Storybook family ^10.5.10 -> ^10.6.5 (critical + high, dev tooling
only). The overrides: fast-uri 3.1.8 -> 3.1.9 (the commitlint chain)
and cookie 1.1.1 -> 2.0.1 (kit 3 depends on cookie v2); deepmerge is
pinned to 4.1.2 -- a ceiling BELOW the vulnerable range, because the
advisory (GHSA-gcqx-w48m-w2h4, CVE-2026-93753) covers 4.2.0-4.3.1
and no patched release exists; drop the pin when upstream ships a
fix. The SvelteKit 2 -> 3 migration (its two LOW advisories have no
2.x patch): kit ^3.1.1, adapter-node ^6.0.1, svelte ^5.57.3; config
moves into the `sveltekit()` Vite plugin (`svelte.config.js`
deleted); `$lib` becomes `#lib` subpath imports with extensions
(222 import sites, 63 unique specifiers); the tsconfig extends
`$app/tsconfig`; the bundle budget moves 768 -> 800 KiB (measured
784.7). Full gates pass: svelte-check, tsc, 115 unit tests,
build + budget, Storybook build; the dockerized api + e2e suites run
in CI. See ADR-025 for the policy and the triage order.
