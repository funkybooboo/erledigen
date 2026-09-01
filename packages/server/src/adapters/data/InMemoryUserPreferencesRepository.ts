import type { DateProvider, UpdateUserPreferencesInput, UserPreferences } from '@erledigen/shared';
import { defaultPreferences } from './preferencesDefaults';
import type { UserPreferencesRepository } from './UserPreferencesRepository';

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
