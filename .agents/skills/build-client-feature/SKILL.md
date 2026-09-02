---
name: build-client-feature
description: Build Erledigen client features the repo's way -- Svelte 5 runes stores, service wrappers, components with Storybook stories, the keybinding registry and tooltip action, websocket ingest, and theme-aware Fizzy styling. Use for any change under packages/client. Includes the Svelte 5 gotchas that have caused real bugs here.
---

# Build a Client Feature

## Layers, in order

1. Types and helpers shared with the server go in `packages/shared/src/` first
   (see the `add-api-endpoint` skill, step 1).
2. `lib/services/<entity>Service.ts`: thin fetch wrapper around
   `container.httpClient`, returning parsed shared types. Services never touch
   stores.
3. `lib/stores/<entity>Store.svelte.ts`: a Svelte 5 runes class.

       class TaskStore {
           tasks = $state<Task[]>([]);
           loading = $state(false);
           error = $state<string | null>(null);
       }
       export const taskStore = new TaskStore();

   - Subscribe to server broadcasts in `initWebSocket()` via
     `websocketService.onServerMessage`, switching on the shared
     `WsServerMessage` union. Upsert by id so this client's own echoed event
     cannot duplicate rows.
   - Use `entityStore.svelte.ts` shared failure logging (`logFailure`) in
     every catch; never swallow errors.
   - No fire-and-forget `.catch(() => {})`: route persistence through a
     helper that logs on failure (see `preferencesStore`).

4. `lib/components/`: `.svelte` file plus sibling `.stories.ts` (Storybook
   builds in CI). Modals live in `components/modals/`, are mounted by
   `ModalHost.svelte`, and open via `uiStore` state, usually from the IconRail.

## Keybindings and tooltips

- Register a new shortcut ONCE in `lib/keybindings.ts` (`SHORTCUTS` +
  `SHORTCUT_SECTIONS`). HelpModal and every tooltip derive from this registry
  automatically; never hand-write a key hint.
- Attach tooltips with the action: `use:tooltip={{ shortcut: ..., label: ... }}`.
  Tooltips must work in BOTH light and dark themes (CSS uses ink/surface
  inversion); check both.
- Global keydown handling lives in `routes/+layout.svelte`; row-level focus
  navigation flows through `uiStore.visibleTaskIds`.

## Styling

Fizzy design tokens in `app.css`; pills (border-radius 999px) are the shape
language. No raw color literals; use tokens. Both themes must look right.
Priority is a TAG (`p1`/`p2`/`p3`), not a field.

## Svelte 5 traps (each has caused a real bug here)

- In async event handlers, capture `$derived` values into locals BEFORE the
  first await; suspension can null the derived value mid-handler.
- Never rely on whitespace between elements for spacing (Svelte strips
  newline-only whitespace); use a flex container with `gap`.
- `getAttribute('aria-pressed')` returns the STRING "false", which is truthy;
  compare with `=== 'true'`.
- Rune-using store files must end in `.svelte.ts`.
- E2E assertions on inputs: values live in `bind:value`, not textContent, so
  `toContainText` can never pass on an input; assert with `toHaveValue`.
- Hydration: markup is server-rendered before Svelte handlers attach; e2e
  helpers wait for `.app-shell[data-hydrated="true"]`.

## Verify

Run the `verify-changes` gates (levels 1-3 always; level 4 for user-visible
behavior). Add e2e coverage in `tests/e2e/<area>.spec.ts` using helpers from
`tests/e2e/util.ts`; add unit tests for store/lib logic (see
`filters.test.ts`, `keybindings.test.ts` for the pattern).