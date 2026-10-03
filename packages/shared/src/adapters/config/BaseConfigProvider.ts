/**
 * Shared implementation skeleton for ConfigProvider adapters.
 *
 * Concrete providers differ only in WHERE raw string values come from
 * (process.env on the server, import.meta.env in the client build) --
 * that is `get` and `has` below. Number/boolean parsing, defaulting,
 * and the ConfigError contract are identical everywhere and live here
 * so the two providers can never drift.
 */

import { ConfigError, type ConfigProvider } from './ConfigProvider';

export abstract class BaseConfigProvider implements ConfigProvider {
    abstract get(key: string, defaultValue?: string): string;
    abstract has(key: string): boolean;

    getNumber(key: string, defaultValue?: number): number {
        const value = this.get(key, defaultValue?.toString());
        const parsed = Number(value);

        if (Number.isNaN(parsed)) {
            throw new ConfigError(key);
        }

        return parsed;
    }

    getBoolean(key: string, defaultValue?: boolean): boolean {
        const value = this.get(key, defaultValue?.toString());

        if (value === 'true' || value === '1') return true;
        if (value === 'false' || value === '0') return false;

        throw new ConfigError(key);
    }
}
