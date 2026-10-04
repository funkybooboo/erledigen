import type {
    DateProvider,
    DayNote,
    DayNoteUpsertResult,
    UpsertDayNoteInput,
} from '@erledigen/shared';
import type { DayNoteRepository } from './DayNoteRepository';

/**
 * In-memory DayNote persistence -- keyed by DATE (the one-row-per-day
 * uniqueness lives in the map key itself).
 */
export class InMemoryDayNoteRepository implements DayNoteRepository {
    private notes = new Map<string, DayNote>();
    private idCounter = 0;

    constructor(private dateProvider: DateProvider) {}

    async findAll(): Promise<DayNote[]> {
        return Array.from(this.notes.values()).sort((a, b) => a.date.localeCompare(b.date));
    }

    async findByDate(date: string): Promise<DayNote | null> {
        return this.notes.get(date) ?? null;
    }

    async upsert(date: string, input: UpsertDayNoteInput): Promise<DayNoteUpsertResult> {
        const existing = this.notes.get(date);
        if (existing) {
            const updated: DayNote = {
                ...existing,
                notes: input.notes,
                updatedAt: this.dateProvider.timestamp(),
            };
            this.notes.set(date, updated);
            return { dayNote: updated, created: false };
        }
        // Stamp ONCE: two timestamp() calls can straddle a clock tick
        // and createdAt would differ from updatedAt (the contract suite
        // asserts they match on create -- CI caught exactly that race).
        const now = this.dateProvider.timestamp();
        const dayNote: DayNote = {
            id: `${++this.idCounter}`,
            date,
            notes: input.notes,
            createdAt: now,
            updatedAt: now,
        };
        this.notes.set(date, dayNote);
        return { dayNote, created: true };
    }

    async replaceAll(dayNotes: DayNote[]): Promise<void> {
        this.notes.clear();
        for (const dayNote of dayNotes) {
            // Keyed by date: a duplicate date in the snapshot would
            // silently drop a row here, but the restore adapter
            // rejects duplicates before the write ever runs.
            this.notes.set(dayNote.date, { ...dayNote });
        }
        this.idCounter = dayNotes.reduce(
            (max, dayNote) => Math.max(max, Number.parseInt(dayNote.id, 10) || 0),
            0,
        );
    }

    async delete(date: string): Promise<boolean> {
        return this.notes.delete(date);
    }
}
