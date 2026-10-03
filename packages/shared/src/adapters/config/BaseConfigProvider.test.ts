import { describe, expect, it } from 'bun:test';
import { BaseConfigProvider } from './BaseConfigProvider';
import { ConfigError } from './ConfigProvider';

/** Minimal concrete provider over a plain record, for parsing tests. */
class MapConfigProvider extends BaseConfigProvider {
    constructor(private readonly values: Record<string, string>) {
        super();
    }

    get(key: string, defaultValue?: string): string {
        const value = this.values[key];
        if (value === undefined) {
            if (defaultValue !== undefined) return defaultValue;
            throw new Error(`missing: ${key}`);
        }
        return value;
    }

    has(key: string): boolean {
        return key in this.values;
    }
}

describe('BaseConfigProvider', () => {
    it('parses numbers, including numeric strings with whitespace', () => {
        const config = new MapConfigProvider({ PORT: '4000', PADDED: ' 12 ' });
        expect(config.getNumber('PORT')).toBe(4000);
        expect(config.getNumber('PADDED')).toBe(12);
    });

    it('falls back to the default when the key is missing', () => {
        const config = new MapConfigProvider({});
        expect(config.getNumber('PORT', 8080)).toBe(8080);
        expect(config.getBoolean('METRICS_ENABLED', true)).toBe(true);
    });

    it('throws ConfigError on a non-numeric value', () => {
        const config = new MapConfigProvider({ PORT: 'abc' });
        expect(() => config.getNumber('PORT')).toThrow(ConfigError);
    });

    it('accepts true/false/1/0 as booleans', () => {
        const config = new MapConfigProvider({
            A: 'true',
            B: '1',
            C: 'false',
            D: '0',
        });
        expect(config.getBoolean('A')).toBe(true);
        expect(config.getBoolean('B')).toBe(true);
        expect(config.getBoolean('C')).toBe(false);
        expect(config.getBoolean('D')).toBe(false);
    });

    it('throws ConfigError on an unparseable boolean', () => {
        const config = new MapConfigProvider({ FLAG: 'yes' });
        expect(() => config.getBoolean('FLAG')).toThrow(ConfigError);
    });
});
