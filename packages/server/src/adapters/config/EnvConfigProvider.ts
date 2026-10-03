/**
 * Environment variable configuration provider
 *
 * Wraps process.env to provide type-safe access to configuration values.
 * This allows the server to be runtime-agnostic - we could swap this
 * for a different config source (file, database, etc.) without
 * changing any business logic.
 */

import { BaseConfigProvider, ConfigError } from '@erledigen/shared';

/**
 * Configuration provider that reads from process.env
 */
export class EnvConfigProvider extends BaseConfigProvider {
    /**
     * Get a string configuration value from process.env
     */
    get(key: string, defaultValue?: string): string {
        const value = process.env[key];

        if (value === undefined) {
            if (defaultValue !== undefined) {
                return defaultValue;
            }
            throw new ConfigError(key);
        }

        return value;
    }

    /**
     * Check if a configuration key exists in process.env
     */
    has(key: string): boolean {
        return process.env[key] !== undefined;
    }
}
