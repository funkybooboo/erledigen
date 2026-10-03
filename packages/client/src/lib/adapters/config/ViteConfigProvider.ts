/**
 * Vite environment variable configuration provider
 *
 * Wraps import.meta.env to provide type-safe access to configuration values.
 * This allows the client to be build-tool-agnostic - we could swap this
 * for a different config source (webpack env, runtime config, etc.) without
 * changing any business logic.
 *
 * Works identically in SvelteKit since it is Vite-based.
 */

import { BaseConfigProvider, ConfigError } from '@erledigen/shared';

/**
 * Configuration provider that reads from import.meta.env (Vite)
 */
export class ViteConfigProvider extends BaseConfigProvider {
    /**
     * Get a string configuration value from import.meta.env
     */
    get(key: string, defaultValue?: string): string {
        // import.meta.env's index signature leaks any; read it typed.
        const value: string | boolean | undefined = import.meta.env[key];

        if (value === undefined) {
            if (defaultValue !== undefined) {
                return defaultValue;
            }
            throw new ConfigError(key);
        }

        // Vite built-ins (DEV/PROD/SSR) are real booleans, not strings;
        // normalize so string-based comparisons in getNumber/getBoolean work.
        return typeof value === 'string' ? value : String(value);
    }

    /**
     * Check if a configuration key exists in import.meta.env
     */
    has(key: string): boolean {
        return import.meta.env[key] !== undefined;
    }
}
