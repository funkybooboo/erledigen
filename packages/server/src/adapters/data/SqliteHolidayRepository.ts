/**
 * SQLite-backed Holiday persistence (see ADR-001).
 *
 * Implements the HolidayRepository contract with raw SQL via bun:sqlite.
 * Behavioral parity with InMemoryHolidayRepository is enforced by the
 * shared contract suite (see contracts/holidayRepositoryContract.ts).
 */

import type { Database, SQLQueryBindings } from 'bun:sqlite';
import type {
    CreateHolidayInput,
    DateProvider,
    Holiday,
    UpdateHolidayInput,
} from '@erledigen/shared';
import type { HolidayRepository } from './HolidayRepository';
import { SqlUpdate } from './sqliteUpdate';

const HOLIDAY_COLUMNS = 'id, name, date, created_at';

interface HolidayRow {
    id: string;
    name: string;
    date: string;
    created_at: string;
}

function mapHolidayRow(row: HolidayRow): Holiday {
    return {
        id: row.id,
        name: row.name,
        date: row.date,
        createdAt: row.created_at,
    };
}

export class SqliteHolidayRepository implements HolidayRepository {
    constructor(
        private readonly db: Database,
        private readonly dateProvider: DateProvider,
    ) {}

    async findAll(): Promise<Holiday[]> {
        return this.select('ORDER BY date ASC, name ASC');
    }

    async findById(id: string): Promise<Holiday | null> {
        const rows = this.select('WHERE id = ?', [id]);
        return rows[0] ?? null;
    }

    async findByDate(date: string): Promise<Holiday[]> {
        return this.select('WHERE date = ?', [date]);
    }

    async create(input: CreateHolidayInput): Promise<Holiday> {
        const id = this.nextId();

        this.db
            .prepare(
                `
                INSERT INTO holidays (${HOLIDAY_COLUMNS})
                VALUES (?, ?, ?, ?)
                `,
            )
            .run(id, input.name, input.date, this.dateProvider.timestamp());

        const created = await this.findById(id);
        if (created === null) {
            throw new Error(`Holiday ${id} missing after insert`);
        }
        return created;
    }

    async replaceAll(holidays: Holiday[]): Promise<void> {
        this.replaceAllSync(holidays);
        return Promise.resolve();
    }

    /** Synchronous core, for composing multi-table restore transactions
     *  (ADR-009) -- see SqliteTaskRepository.replaceAllSync. */
    replaceAllSync(holidays: Holiday[]): void {
        const insert = this.db.prepare(
            `
            INSERT INTO holidays (${HOLIDAY_COLUMNS})
            VALUES (?, ?, ?, ?)
            `,
        );
        this.db.transaction(() => {
            this.db.prepare('DELETE FROM holidays').run();
            for (const holiday of holidays) {
                insert.run(holiday.id, holiday.name, holiday.date, holiday.createdAt);
            }
        })();
    }

    async update(id: string, input: UpdateHolidayInput): Promise<Holiday | null> {
        const patch = new SqlUpdate();

        if ('name' in input) patch.assign('name', input.name);
        if ('date' in input) patch.assign('date', input.date);

        if (patch.isEmpty) return this.findById(id);

        const result = this.db
            .prepare(`UPDATE holidays SET ${patch.assignments} WHERE id = ?`)
            .run(...patch.parameters, id);

        if (result.changes === 0) return null;
        return this.findById(id);
    }

    async delete(id: string): Promise<boolean> {
        const result = this.db.prepare('DELETE FROM holidays WHERE id = ?').run(id);
        return result.changes > 0;
    }

    private select(where: string, params: SQLQueryBindings[] = []): Holiday[] {
        const rows = this.db
            .prepare(`SELECT ${HOLIDAY_COLUMNS} FROM holidays ${where}`)
            .all(...params) as HolidayRow[];
        return rows.map(mapHolidayRow);
    }

    private nextId(): string {
        const row = this.db
            .prepare('SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 AS next FROM holidays')
            .get() as { next: number };
        return String(row.next);
    }
}
