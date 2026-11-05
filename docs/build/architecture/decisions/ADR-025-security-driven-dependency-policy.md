# ADR-025: The Security Audit Gate: Patch, Override, or Migrate -- Never Ignore

Date: 2026-11-04

Status: Accepted

## Context

The branch ruleset lists "Security Audit" (`bun audit` in CI) among the
required status checks, so a red audit blocks every PR merge. In
early November 2026 ten advisories landed at once and froze the
v0.13.1 release path:

- **Storybook** (critical: missing origin validation in the preview;
  high: dev-server code injection from the local network) -- dev
  tooling only, never shipped; patched in 10.6.2, in range of the
  declared `^10.5.10`.
- **Zod** (high: memory exhaustion validating oversized constrained
  collections) -- this is production code: the server validates every
  API request with Zod. Patched in 4.6.6, in range of `^4.5.4`.
- **SvelteKit** (low x2: URL redirection via enhanced form
  submission; XSS via an untrusted cache-control header in
  prerendered pages) -- patched only in SvelteKit 3.x. No 2.x release
  fixes them. This app uses neither affected surface (no form
  actions, no prerendering), but the audit matches on version, not
  on usage.
- **fast-uri** (moderate + lows; the commitlint chain
  `@commitlint/cli -> ajv -> fast-uri`) -- patched in 3.1.9; the root
  override pinned 3.1.8.
- **deepmerge** (low: prototype poisoning in `mergeObject()`) --
  **no patched release exists anywhere**: the advisory covers
  4.2.0-4.3.1 and 4.3.1 is the latest published version. Consumers
  are `@rollup/plugin-node-resolve` (declares `^4.2.2`) and
  `@sveltejs/vite-plugin-svelte` (declares `^4.3.1`), both
  build-time only.

`tools/update-deps.sh` documents the repo's override precedent: floors
are exact-pinned to patched versions over vulnerable transitive
ranges (fast-uri, cookie, devalue), and the cookie override already
sits outside the consumer's declared range (kit 2 declares
`cookie ^0.6.0`; the tree pins the patched 1.1.1).

## Decision

1. **The Security Audit check stays required.** Green must mean
   patched. The workflow job keeps its `continue-on-error` (the run
   itself stays green for reporting), but the ruleset holds the
   merge: an advisory is a blocker until a version move clears it.
2. **The triage order for every advisory:**
   1. an in-range bump of the vulnerable package (zod, Storybook);
   2. an exact-pinned override of the vulnerable transitive
      (fast-uri 3.1.9, cookie 2.0.1 with kit 3);
   3. when no patched release exists anywhere, an override **ceiling
      below the vulnerable range** (deepmerge pinned to 4.1.2 --
      the advisory starts at 4.2.0; both consumers only call the
      default `deepmerge()`, present since 1.x; drop the override
      when upstream ships a fix);
   4. when the fix only exists in a newer major, take the major as a
      deliberate migration validated by the full gates (SvelteKit 3)
      -- the gate forces the question, it does not get silenced.
3. **`bun audit --ignore` is an exception of last resort** -- for an
   advisory that cannot be cleared by any version move. This sweep
   needed none.
4. **The SvelteKit 3 migration** (kit 2.70.3 -> 3.1.1,
   adapter-node 5.5.7 -> 6.0.1, svelte -> ^5.57.3):
   - kit config moves from `svelte.config.js` into the `sveltekit()`
     Vite plugin (`adapter` top-level; `preprocess` passes through to
     vite-plugin-svelte); `svelte.config.js` is deleted.
   - `$lib` becomes `#lib` -- Node subpath imports declared in the
     client `package.json` `imports` field. Node semantics require
     exact targets, so every import carries its extension
     (`'#lib/stores/index.ts'`, `'#lib/i18n/i18nStore.svelte.ts'`).
     The deprecated `alias` plugin option is not used.
   - the generated tsconfig now lives at `node_modules/$app/tsconfig`;
     the client tsconfig extends it and must keep `$app/types` in
     `types`.
   - kit 3 depends on cookie v2; the root cookie override moves
     1.1.1 -> 2.0.1 (exact-pinned).
   - the client bundle budget moves 768 -> 800 KiB (measured 784.7:
     the kit 3 runtime -- modulepreload everywhere, cookie v2).
     Prod runs the adapter-node output on `node:24-alpine`, above
     kit 3's Node 22 floor.

## Consequences

- The release train never waits on an advisory triage decision --
  the policy decides it: patch, override, or migrate.
- The deepmerge override is a ceiling below the consumers' declared
  ranges. It works because the vulnerable surface
  (`mergeObject()`) postdates what the consumers call, and the
  build-time usage is exercised by every `tools/build.sh` run; it
  must be dropped when a patched deepmerge ships.
- Extensionless `#lib` imports are gone permanently: any new import
  that omits its extension fails type-check, not just runtime.
- The audit floor keeps ratcheting: every future advisory lands on
  this policy, and `tools/update-deps.sh`'s preflight stays the
  first stop (it prints the override floors and the current audit).
- A genuinely unfixable advisory (no version move possible) would
  need an explicit, recorded `--ignore` in `mise.toml`'s `security`
  task with the CVE named -- a decision for a future ADR, not a
  quiet workaround.
