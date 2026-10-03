/**
 * Partial UPDATE statement builder for SQLite repositories (see ADR-001).
 *
 * Every Sqlite*Repository.update() assigns only the fields present in the
 * request body (Partial input). The sets/values/assign closure that built
 * those "column = ?" fragments lived in each repository; this class is the
 * one shared implementation.
 */

import type { SQLQueryBindings } from 'bun:sqlite';

export class SqlUpdate {
    private readonly sets: string[] = [];
    private readonly values: SQLQueryBindings[] = [];

    /** Record an assignment; `value` must already be a SQL-safe binding
     *  (booleans through toInteger, arrays/objects through JSON.stringify). */
    assign(column: string, value: SQLQueryBindings): void {
        this.sets.push(`${column} = ?`);
        this.values.push(value);
    }

    /** True when no field was assigned (the update is a no-op read-back). */
    get isEmpty(): boolean {
        return this.sets.length === 0;
    }

    /** The SET clause: "col_a = ?, col_b = ?" -- empty string when empty. */
    get assignments(): string {
        return this.sets.join(', ');
    }

    /** The bound values, in assignment order (the id still gets appended
     *  by the caller's WHERE clause). */
    get parameters(): SQLQueryBindings[] {
        return this.values;
    }
}
