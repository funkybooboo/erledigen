import type { DateProvider, UpdateUserPreferencesInput, UserPreferences } from '@erledigen/shared';
import { USER_PREFERENCES_DEFAULTS } from '@erledigen/shared';
import type { UserPreferencesRepository } from './UserPreferencesRepository';

/**
 * Build a fresh, deeply-copied defaults object. Spreads the shared
 * `USER_PREFERENCES_DEFAULTS` table (single source of truth) and clones the
 * nested mutable fields so callers can mutate freely without touching the
 * shared constant. `id`/`updatedAt` are not part of the defaults table.
 */
function defaultPreferences(timestamp: string): UserPreferences {
    return {
        ...USER_PREFERENCES_DEFAULTS,
        id: 'default',
        activeFilters: { ...USER_PREFERENCES_DEFAULTS.activeFilters },
        tagKinds: [...USER_PREFERENCES_DEFAULTS.tagKinds],
        tagKindMap: { ...USER_PREFERENCES_DEFAULTS.tagKindMap },
        updatedAt: timestamp,
    };
}

export class InMemoryUserPreferencesRepository implements UserPreferencesRepository {
    private preferences: UserPreferences;

    constructor(private dateProvider: DateProvider) {
        this.preferences = defaultPreferences(this.dateProvider.timestamp());
    }

    async get(): Promise<UserPreferences> {
        return {
            ...this.preferences,
            activeFilters: { ...this.preferences.activeFilters },
            tagKinds: [...this.preferences.tagKinds],
            tagKindMap: { ...this.preferences.tagKindMap },
        };
    }

    async update(input: UpdateUserPreferencesInput): Promise<UserPreferences> {
        this.preferences = {
            ...this.preferences,
            ...input,
            activeFilters: input.activeFilters
                ? { ...input.activeFilters }
                : { ...this.preferences.activeFilters },
            tagKinds: input.tagKinds ? [...input.tagKinds] : [...this.preferences.tagKinds],
            tagKindMap: input.tagKindMap
                ? { ...input.tagKindMap }
                : { ...this.preferences.tagKindMap },
            updatedAt: this.dateProvider.timestamp(),
        };
        return this.get();
    }

    async reset(): Promise<void> {
        this.preferences = defaultPreferences(this.dateProvider.timestamp());
    }
}
