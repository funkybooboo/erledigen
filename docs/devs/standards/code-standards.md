# Code Standards

Coding standards for the Erledigen project. The generic rules below are
enforced automatically by TypeScript (strict mode) and Biome (see
[Enforcement](#enforcement)) -- the sections worth reading carefully are the
[Svelte gotchas](#svelte-specific-standards) and
[Bun runtime gotchas](#bun-runtime-gotchas), because each of those has cost
real debugging time in this repo.

## Philosophy

- **Explicit over implicit** -- make intent clear through types and names
- **Readable over clever** -- code is read far more often than written
- **Safe over convenient** -- type safety prevents bugs at compile time
- **Self-documenting** -- good names and structure reduce the need for comments

## Type Safety

- **Zero `any` types** (implicit or explicit). Use `unknown` and narrow with
  type guards.
- **Explicit return types** on all functions, including `void` and
  `Promise<T>`.
- **Avoid type assertions.** Prefer type guards; when an assertion is
  unavoidable (e.g. Bun's native `json()` types), comment WHY.
- **Handle `null`/`undefined` explicitly.** No non-null assertions (`!`)
  without justification; prefer `?.` with a fallback or an explicit throw.
- **No floating promises.** Await them or attach a `.catch` that logs.

```typescript
// [OK] unknown + type guard beats assertion
function handleError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unknown error occurred';
}
```

## Naming

- **Descriptive names; clarity over brevity.** No `usr`, `temp`, `res`, `cfg`.
- **Functions are verbs**: `getUserById`, `validateInput`, `hasRequiredFields`.
- **Booleans are predicates**: `isActive`, `canEditTask`.
- **No `I` prefix on interfaces** -- they are the abstraction, not an
  implementation detail.
- **camelCase for multi-word abbreviations**: `myApi` not `myAPI`, `userId`
  not `userID`, `parseUrl` not `parseURL`. Single common abbreviations (`id`,
  `url`, `api`) are fine as-is.
- **Domain terminology in names**, not technical jargon: `archiveCompletedTasks`,
  not `processRecords`.
- UPPER_SNAKE_CASE only for truly global constants.

## Files and Exports

- Kebab-case file names matching the primary export: `task-repository.ts`,
  `http-client.ts`.
- Prefer named exports over default exports.
- Use `import type` for type-only imports (Biome enforces); keep imports
  sorted (external before local, types before values).

## Comments and JSDoc

- **JSDoc on exported functions, classes, and types** -- what it does, params,
  what it throws, a short example for non-obvious APIs.
- **Inline comments explain WHY, never WHAT.** Comment non-obvious design
  decisions, workarounds, business rules, and performance choices. Do not
  comment obvious code or what names already say -- refactor instead.

## Error Handling

- **Throw typed error classes** (`NotFoundError`, `ValidationError`), never
  strings or plain objects.
- **Catch blocks receive `unknown`** (`useUnknownInCatchVariables` is on) --
  narrow with `instanceof` before using, and never swallow silently; log
  through the `Logger` adapter.

## Svelte-Specific Standards

### Component Props Typing

**Rule**: Component props must have explicit TypeScript types.

```svelte
<!-- [OK] GOOD -->
<script lang="ts">
  import type { User } from '@erledigen/shared';

  interface Props {
    user: User;
    onEdit?: (user: User) => void;
  }

  let { user, onEdit }: Props = $props();
</script>
```

Event handlers must have explicit types too (`event: MouseEvent`, not bare
`event`).

### Runes and Reactivity Gotchas

Each of these has shipped a real bug in this repo.

- **Capture `$derived` values into a local BEFORE the first `await`** in an
  async event handler. While the handler is suspended, a later write in the
  same handler (e.g. clearing the input) nulls the derived mid-flight --
  this caused a crash in the inline habit-hint parser. Snapshot the value
  first, then await.
- **Rune-using non-component files must end in `.svelte.ts`.** A plain `.ts`
  store file silently cannot use `$state`/`$derived`.
- **Never rely on template whitespace for spacing.** Svelte 5 strips
  newline-only whitespace between elements; a "g t" chord once rendered as
  "gt" with no space. Space with CSS (flex `gap`), always.
- **`getAttribute('aria-pressed')` returns a STRING** -- `"false"` is truthy.
  Compare with `=== 'true'`.

### SSR, Hydration, and E2E Assertions

- The app is server-rendered: markup exists before any event handler
  attaches. `+layout.svelte` sets `data-hydrated="true"` on `.app-shell` in
  `onMount`; e2e tests must wait for it (see `hydrated()` in
  `tests/e2e/util.ts`) before interacting -- earlier clicks silently do
  nothing.
- `bind:value` inputs expose a value, not text content, so a `toContainText`
  assertion on one can never pass; use `toHaveValue`.

### Theming and Shared UI Conventions

- Components must work in BOTH light and dark themes. Prefer the tooltip
  pattern in `app.css` -- ink/surface token inversion serves both themes from
  one rule -- over theme-specific overrides.
- Keybinding hints come from the single registry in
  `packages/client/src/lib/keybindings.ts`; the help modal and every tooltip
  derive from it. Never hand-write a keybinding hint.

### Date Handling

Task dates are local `yyyy-MM-dd` key strings. Do date math through the
shared `dateProvider` helpers (`today()`, `addDays`), never `new Date()`
arithmetic -- deriving dates from `Date` objects shipped a timezone bug in
the calendar. (`new Date()` is fine for wall-clock display, e.g. the
bottom-bar clock.)

## Bun Runtime Gotchas

Each of these has cost real debugging time in this repo.

- **Package-script wrappers leak child processes.** `bun run dev` /
  `bun run start` spawn a wrapper; `kill $!` kills the wrapper and leaves the
  real server child alive, still holding the port. When running a server
  manually, invoke the entry directly (`bun packages/server/src/index.ts`)
  and verify with `lsof -ti:<port>` after killing (`bun run kill-server-port`
  reclaims 4000).
- **`bun build` does not bundle `.sql`.** The server build script copies
  `src/adapters/data/migrations/` into `dist/` explicitly -- a migration that
  is not committed passes locally (dev runs from source) but breaks every
  docker and CI build. Always commit migrations together with the code that
  needs them.
- **The two storage adapters are not behaviorally identical.**
  `projects.tag` is UNIQUE in SQLite but not in-memory, so the same POST
  passes on memory and 500s on SQLite. Any repository-behavior change must
  extend the contract suites in
  `packages/server/src/adapters/data/contracts/`, which run against both
  adapters.
- **Test code sets `process.env['STORAGE_ADAPTER']` with bracket access** --
  `noPropertyAccessFromIndexSignature` rejects dot access on index
  signatures.
- **Regex: avoid one large alternation with a lazy prefix and nested optional
  groups.** A Bun/JS backtracking pathology then rejects VALID input (this
  forced a rewrite of `parseRecurrence`). Build parsers as an ordered array
  of small anchored regexes, and suspect this first when a parser
  mysteriously rejects valid input.
- **The client build is size-gated**: CI fails when `packages/client/dist`
  exceeds 512KB (see [ci-cd-pipeline.md](../process/ci-cd-pipeline.md)) --
  think twice before adding dependencies or large static assets.

## Enforcement

The TypeScript compiler (`strict`, `noImplicitAny`,
`useUnknownInCatchVariables`, `exactOptionalPropertyTypes`, ...) and Biome
(`noExplicitAny`, `useImportType`, `noNonNullAssertion`, `noUnusedVariables`,
`noUnusedImports`, ...) enforce most of the above automatically.

```bash
bun run format      # Biome format (auto-fix)
bun run lint        # Biome lint (auto-fix)
bun run type-check  # tsc --noEmit for all packages
bun run validate    # repo-wide checks (what CI runs)
```

When in doubt, choose the more explicit, more type-safe option.
