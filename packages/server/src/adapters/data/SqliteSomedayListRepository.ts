/**
 * SQLite-backed SomedayList persistence (see ADR-001)
 *
 * Implements the SomedayListRepository contract with raw SQL via
 * bun:sqlite. Behavioral parity with InMemorySomedayListRepository is
 * enforced by the shared contract test suite (see
 * contracts/somedayListRepositoryContract.ts).
 */

import type { Database, SQLQueryBindings } from 'bun:sqlite';
import type {
    CreateSomedayListInput,
    DateProvider,
    SomedayList,
    UpdateSomedayListInput,
} from '@erledigen/shared';
import type { SomedayListRepository } from './SomedayListRepository';
import { SqlUpdate } from './sqliteUpdate';

const LIST_COLUMNS = 'id, tab_id, name, position, created_at';

interface SomedayListRow {
    id: string;
    tab_id: string;
    name: string;
    position: number;
    created_at: string;
}

function mapSomedayListRow(row: SomedayListRow): SomedayList {
    return {
        id: row.id,
        tabId: row.tab_id,
        name: row.name,
        position: row.position,
        createdAt: row.created_at,
    };
}

export class SqliteSomedayListRepository implements SomedayListRepository {
    constructor(
        private readonly db: Database,
        private readonly dateProvider: DateProvider,
    ) {}

    async findAll(): Promise<SomedayList[]> {
        return this.select('ORDER BY position ASC, created_at ASC');
    }

    async findById(id: string): Promise<SomedayList | null> {
        const rows = this.select('WHERE id = ?', [id]);
        return rows[0] ?? null;
    }

    async create(input: CreateSomedayListInput): Promise<SomedayList> {
        const id = this.nextId();

        this.db
            .prepare(
                `
                INSERT INTO someday_lists (${LIST_COLUMNS})
                VALUES (?, ?, ?, ?, ?)
                `,
            )
            .run(id, input.tabId, input.name, input.position, this.dateProvider.timestamp());

        const created = await this.findById(id);
        if (created === null) {
            throw new Error(`SomedayList ${id} missing after insert`);
        }
        return created;
    }

    async replaceAll(lists: SomedayList[]): Promise<void> {
        this.replaceAllSync(lists);
        return Promise.resolve();
    }

    /** Synchronous core, for composing multi-table restore transactions
     *  (ADR-009) -- see SqliteTaskRepository.replaceAllSync. */
    replaceAllSync(lists: SomedayList[]): void {
        const insert = this.db.prepare(
            `
            INSERT INTO someday_lists (${LIST_COLUMNS})
            VALUES (?, ?, ?, ?, ?)
            `,
        );
        this.db.transaction(() => {
            this.db.prepare('DELETE FROM someday_lists').run();
            for (const list of lists) {
                insert.run(list.id, list.tabId, list.name, list.position, list.createdAt);
            }
        })();
    }

    async update(id: string, input: UpdateSomedayListInput): Promise<SomedayList | null> {
        const patch = new SqlUpdate();

        if ('tabId' in input) patch.assign('tab_id', input.tabId);
        if ('name' in input) patch.assign('name', input.name);
        if ('position' in input) patch.assign('position', input.position);

        if (patch.isEmpty) return this.findById(id);

        const result = this.db
            .prepare(`UPDATE someday_lists SET ${patch.assignments} WHERE id = ?`)
            .run(...patch.parameters, id);

        if (result.changes === 0) return null;
        return this.findById(id);
    }

    async delete(id: string): Promise<boolean> {
        const result = this.db.prepare('DELETE FROM someday_lists WHERE id = ?').run(id);
        return result.changes > 0;
    }

    private select(where: string, params: SQLQueryBindings[] = []): SomedayList[] {
        const rows = this.db
            .prepare(`SELECT ${LIST_COLUMNS} FROM someday_lists ${where}`)
            .all(...params) as SomedayListRow[];
        return rows.map(mapSomedayListRow);
    }

    private nextId(): string {
        const row = this.db
            .prepare('SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 AS next FROM someday_lists')
            .get() as { next: number };
        return String(row.next);
    }
}
