import type { UpdateUserPreferencesInput, UserPreferences } from '@erledigen/shared';

/**
 * Repository interface for UserPreferences persistence.
 * Single-row entity -- always id 'default'.
 */
export interface UserPreferencesRepository {
    get(): Promise<UserPreferences>;
    update(input: UpdateUserPreferencesInput): Promise<UserPreferences>;
    reset(): Promise<void>;
    /** Destructive restore (ADR-009): store the snapshot's preferences
     *  verbatim, updatedAt included. */
    restore(prefs: UserPreferences): Promise<void>;
}
