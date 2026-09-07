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

/**
 * The `YYYY-MM` month key containing a `YYYY-MM-DD` date key.
 */
export function monthKeyOf(dateStr: string): string {
    return dateStr.slice(0, 7);
}

/**
 * Parse a `YYYY-MM` month key into `[year, month]` (month 1-based).
 */
function splitMonthKey(monthKey: string): [number, number] {
    const parts = monthKey.split('-').map(Number);
    return [parts[0] ?? 1, parts[1] ?? 1];
}

/**
 * Add months to a `YYYY-MM` month key (negative supported). Pure
 * Gregorian arithmetic on the key, same contract as addDays -- no Date
 * objects, no DST, rolls year boundaries correctly.
 *
 * Precondition: a well-formed `YYYY-MM` key within the representable
 * range (the minimap navigates a bounded window around the current era).
 */
export function addMonths(monthKey: string, months: number): string {
    const [y, m] = splitMonthKey(monthKey);
    // Linear month index; JS % is negative for negative indices, so the
    // result is only meaningful for indices >= 0 (see precondition).
    const idx = (y - 1) * 12 + (m - 1) + months;
    const ny = Math.floor(idx / 12) + 1;
    const nm = (idx % 12) + 1;
    return `${ny}-${String(nm).padStart(2, '0')}`;
}

/**
 * Inclusive list of month keys from `start` to `end` in calendar order.
 * Same contract as dateRangeKeys: empty when `start` is after `end`.
 */
export function monthRangeKeys(start: string, end: string): string[] {
    const out: string[] = [];
    let cursor = start;
    while (cursor <= end) {
        out.push(cursor);
        cursor = addMonths(cursor, 1);
    }
    return out;
}
