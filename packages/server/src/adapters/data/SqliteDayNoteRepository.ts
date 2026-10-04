/**
 * SQLite-backed DayNote persistence (see ADR-001).
 *
 * Implements the DayNoteRepository contract with raw SQL via
 * bun:sqlite. Behavioral parity with InMemoryDayNoteRepository is
 * enforced by the shared contract suite (see
 * contracts/dayNoteRepositoryContract.ts).
 */

import type { Database, SQLQueryBindings } from 'bun:sqlite';
import type {
    DateProvider,
    DayNote,
    DayNoteUpsertResult,
    UpsertDayNoteInput,
} from '@erledigen/shared';
import type { DayNoteRepository } from './DayNoteRepository';
import { SqlUpdate } from './sqliteUpdate';

const DAY_NOTE_COLUMNS = 'id, date, notes, created_at, updated_at';

interface DayNoteRow {
    id: string;
    date: string;
    notes: string;
    created_at: string;
    updated_at: string;
}

function mapDayNoteRow(row: DayNoteRow): DayNote {
    return {
        id: row.id,
        date: row.date,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export class SqliteDayNoteRepository implements DayNoteRepository {
    constructor(
        private readonly db: Database,
        private readonly dateProvider: DateProvider,
    ) {}

    async findAll(): Promise<DayNote[]> {
        return this.select('ORDER BY date ASC');
    }

    async findByDate(date: string): Promise<DayNote | null> {
        const rows = this.select('WHERE date = ?', [date]);
        return rows[0] ?? null;
    }

    async upsert(date: string, input: UpsertDayNoteInput): Promise<DayNoteUpsertResult> {
        const existing = await this.findByDate(date);
        if (existing) {
            const patch = new SqlUpdate();
            patch.assign('notes', input.notes);
            patch.assign('updated_at', this.dateProvider.timestamp());
            this.db
                .prepare(`UPDATE day_notes SET ${patch.assignments} WHERE date = ?`)
                .run(...patch.parameters, date);
            const updated = await this.findByDate(date);
            if (updated === null) {
                throw new Error(`Day note for ${date} missing after update`);
            }
            return { dayNote: updated, created: false };
        }

        const id = this.nextId();
        const now = this.dateProvider.timestamp();
        this.db
            .prepare(
                `
                INSERT INTO day_notes (${DAY_NOTE_COLUMNS})
                VALUES (?, ?, ?, ?, ?)
                `,
            )
            .run(id, date, input.notes, now, now);

        const created = await this.findByDate(date);
        if (created === null) {
            throw new Error(`Day note for ${date} missing after insert`);
        }
        return { dayNote: created, created: true };
    }

    async replaceAll(dayNotes: DayNote[]): Promise<void> {
        this.replaceAllSync(dayNotes);
        return Promise.resolve();
    }

    /** Synchronous core, for composing multi-table restore transactions
     *  (ADR-009) -- see SqliteTaskRepository.replaceAllSync. */
    replaceAllSync(dayNotes: DayNote[]): void {
        const insert = this.db.prepare(
            `
            INSERT INTO day_notes (${DAY_NOTE_COLUMNS})
            VALUES (?, ?, ?, ?, ?)
            `,
        );
        this.db.transaction(() => {
            this.db.prepare('DELETE FROM day_notes').run();
            for (const dayNote of dayNotes) {
                insert.run(
                    dayNote.id,
                    dayNote.date,
                    dayNote.notes,
                    dayNote.createdAt,
                    dayNote.updatedAt,
                );
            }
        })();
    }

    async delete(date: string): Promise<boolean> {
        const result = this.db.prepare('DELETE FROM day_notes WHERE date = ?').run(date);
        return result.changes > 0;
    }

    private select(where: string, params: SQLQueryBindings[] = []): DayNote[] {
        const rows = this.db
            .prepare(`SELECT ${DAY_NOTE_COLUMNS} FROM day_notes ${where}`)
            .all(...params) as DayNoteRow[];
        return rows.map(mapDayNoteRow);
    }

    private nextId(): string {
        const row = this.db
            .prepare('SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 AS next FROM day_notes')
            .get() as { next: number };
        return String(row.next);
    }
}
