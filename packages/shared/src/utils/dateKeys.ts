/**
 * Pure calendar-date key math for `YYYY-MM-DD` strings.
 *
 * Keys are manipulated as pure Gregorian dates via `Date.UTC`, never by
 * 24-hour arithmetic on a `Date` and never via `new Date('YYYY-MM-DD')`
 * (which parses as UTC midnight and shifts the day in negative-offset
 * zones). `Date.UTC(y, m, d + days)` rolls month/year correctly and has
 * no DST, so every function here is DST-proof and zone-independent.
 */

const MS_PER_DAY = 86_400_000;

/**
 * Parse a `YYYY-MM-DD` key into its numeric components.
 * @returns `[year, monthIndex, day]` where monthIndex is 0-based (Date/Date.UTC convention)
 */
export function splitKey(dateStr: string): [number, number, number] {
    const parts = dateStr.split('-').map(Number);
    return [parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1];
}

/**
 * Rebuild a `YYYY-MM-DD` key from numeric components.
 * @param y - year
 * @param m - monthIndex (0-based, Date.UTC convention)
 * @param d - day of month
 */
export function keyFromParts(y: number, m: number, d: number): string {
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/**
 * Add days to a date key. DST-proof, zone-independent; negative days supported.
 */
export function addDays(dateStr: string, days: number): string {
    const [y, m, d] = splitKey(dateStr);
    const shifted = new Date(Date.UTC(y, m, d + days));
    return keyFromParts(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

/**
 * Whole calendar days from `a` to `b` (positive when `b` is after `a`).
 * DST-proof (UTC has no DST).
 */
export function daysBetween(a: string, b: string): number {
    const [y1, m1, d1] = splitKey(a);
    const [y2, m2, d2] = splitKey(b);
    return Math.round((Date.UTC(y2, m2, d2) - Date.UTC(y1, m1, d1)) / MS_PER_DAY);
}

/**
 * Weekday of a date key: 0 = Sunday .. 6 = Saturday.
 */
export function weekdayOf(dateStr: string): number {
    const [y, m, d] = splitKey(dateStr);
    return new Date(Date.UTC(y, m, d)).getUTCDay();
}

/**
 * Inclusive list of date keys from `start` to `end` in calendar order.
 * Returns an empty array when `start` is after `end`; the cursor always
 * advances, so the loop can never run away.
 */
export function dateRangeKeys(start: string, end: string): string[] {
    const out: string[] = [];
    let cursor = start;
    while (cursor <= end) {
        out.push(cursor);
        cursor = addDays(cursor, 1);
    }
    return out;
}
