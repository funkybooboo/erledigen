/**
 * Factory for default UserPreferences rows.
 *
 * Single-row entity (always id 'default'): when no row has been persisted,
 * repositories serve a fresh defaults object built from the shared
 * `USER_PREFERENCES_DEFAULTS` table. Nested mutable fields are cloned so
 * callers can mutate freely without touching the shared constant.
 */

import type { UserPreferences } from '@erledigen/shared';
import { USER_PREFERENCES_DEFAULTS } from '@erledigen/shared';

export function defaultPreferences(timestamp: string): UserPreferences {
    return {
        ...USER_PREFERENCES_DEFAULTS,
        id: 'default',
        activeFilters: { ...USER_PREFERENCES_DEFAULTS.activeFilters },
        tagKinds: [...USER_PREFERENCES_DEFAULTS.tagKinds],
        tagKindMap: { ...USER_PREFERENCES_DEFAULTS.tagKindMap },
        updatedAt: timestamp,
    };
}
