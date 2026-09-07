import { SvelteSet } from 'svelte/reactivity';

const FLASH_MS = 600;

export interface NewlyCreatedTracker {
    /** Whether the id is still in its post-creation flash window. */
    has(id: string): boolean;
    /** Start the flash window for a newly created task id. */
    add(id: string): void;
}

/**
 * Tracks freshly created task ids for the 600ms row-flash animation.
 * Shared by DaySection and the Someday panel so the behavior (and the
 * SvelteSet trap below) is defined once.
 *
 * SvelteSet (not $state<Set>): Svelte 5 deep-proxies only plain
 * objects/arrays, so .add()/.delete() on a raw Set never signals and the
 * expiry would leave the flash class on until an unrelated re-render.
 */
export function createNewlyCreatedTracker(): NewlyCreatedTracker {
    const ids = new SvelteSet<string>();
    return {
        has: (id: string) => ids.has(id),
        add: (id: string) => {
            ids.add(id);
            setTimeout(() => ids.delete(id), FLASH_MS);
        },
    };
}
