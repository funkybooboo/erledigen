/**
 * Type-mapping helpers for SQLite columns (see ADR-001)
 *
 * TypeScript/SQLite type mapping used by every Sqlite* repository:
 *   boolean <-> INTEGER (0/1)
 *   string[] / nested objects <-> JSON-encoded TEXT
 */

/**
 * Parse a JSON TEXT column. Returns the fallback when the column is NULL or
 * holds malformed JSON, so a corrupt row degrades to a default value instead
 * of crashing a request.
 */
export function parseJsonColumn<T>(raw: string | null, fallback: T): T {
    if (raw === null) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

/** Map a SQLite 0/1 INTEGER column to a boolean. */
export function toBoolean(value: number): boolean {
    return value !== 0;
}

/** Map a boolean to a SQLite 0/1 INTEGER parameter. */
export function toInteger(value: boolean): number {
    return value ? 1 : 0;
}
