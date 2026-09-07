/**
 * Refetch every store from the server -- used after a JSON restore
 * (ADR-009), where the response replaced all application data at once
 * and no per-row event can describe the change.
 *
 * The restore broadcast (data:restored) covers OTHER connected clients;
 * this covers the restoring client itself, which the server skips for
 * its own events (the realtime double-skip).
 */

import { preferencesStore } from './preferencesStore.svelte';
import { projectStore } from './projectStore.svelte';
import { someDayGroupStore } from './someDayGroupStore.svelte';
import { tagStore } from './tagStore.svelte';
import { taskStore } from './taskStore.svelte';

export async function refetchAllStores(): Promise<void> {
    // Preferences too: a restore includes the snapshot's preferences,
    // so the theme may legitimately flip on this client.
    await Promise.all([
        preferencesStore.load(),
        taskStore.fetchAll(),
        tagStore.fetchAll(),
        projectStore.fetchAll(),
        someDayGroupStore.fetchAll(),
    ]);
}
