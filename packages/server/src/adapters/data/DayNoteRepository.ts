import type { DayNote, DayNoteUpsertResult, UpsertDayNoteInput } from '@erledigen/shared';

/**
 * Repository interface for DayNote persistence (v0.10.0).
 *
 * Day notes are addressed by DATE, not id: exactly one note exists per
 * day, created lazily on first write and deleted when emptied. The id
 * is internal bookkeeping the export snapshot keeps verbatim.
 */
export interface DayNoteRepository {
    /** Every day note, in date order. */
    findAll(): Promise<DayNote[]>;
    /** The note for one date, or null. */
    findByDate(date: string): Promise<DayNote | null>;
    /** Create-or-replace the note for a date. */
    upsert(date: string, input: UpsertDayNoteInput): Promise<DayNoteUpsertResult>;
    /** Destructive restore (ADR-009): replace every row with the given
     *  day notes, verbatim (ids and timestamps kept). */
    replaceAll(dayNotes: DayNote[]): Promise<void>;
    /** Delete the note for a date (true when one existed). */
    delete(date: string): Promise<boolean>;
}
