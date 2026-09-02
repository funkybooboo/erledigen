import type { UpdateUserPreferencesInput, UserPreferences } from '@erledigen/shared';

/**
 * Repository interface for UserPreferences persistence.
 * Single-row entity -- always id 'default'.
 */
export interface UserPreferencesRepository {
    get(): Promise<UserPreferences>;
    update(input: UpdateUserPreferencesInput): Promise<UserPreferences>;
    reset(): Promise<void>;
}
