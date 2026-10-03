import type { CreateHolidayInput, Holiday, UpdateHolidayInput } from '@erledigen/shared';

/**
 * Repository interface for Holiday persistence (v0.9.0).
 *
 * Holidays are plain named dates -- no tag linkage, no nesting. Ordering
 * is date-then-name (the banner and Summary lists read in calendar
 * order), so the repository itself needs no position field.
 */
export interface HolidayRepository {
    findAll(): Promise<Holiday[]>;
    findById(id: string): Promise<Holiday | null>;
    /** Every holiday on the given date (usually zero or one). */
    findByDate(date: string): Promise<Holiday[]>;
    create(input: CreateHolidayInput): Promise<Holiday>;
    /** Destructive restore (ADR-009): replace every row with the given
     *  holidays, verbatim (ids and timestamps kept). */
    replaceAll(holidays: Holiday[]): Promise<void>;
    update(id: string, input: UpdateHolidayInput): Promise<Holiday | null>;
    delete(id: string): Promise<boolean>;
}
