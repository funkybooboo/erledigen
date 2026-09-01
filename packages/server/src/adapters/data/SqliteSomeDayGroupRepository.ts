/**
 * SQLite-backed SomeDayGroup persistence (see ADR-001)
 *
 * Implements the SomeDayGroupRepository contract with raw SQL via bun:sqlite.
 * Behavioral parity with InMemorySomeDayGroupRepository is enforced by the
 * shared contract test suite (see contracts/someDayGroupRepositoryContract.ts).
 */

import type { Database, SQLQueryBindings } from 'bun:sqlite';
import type {
    CreateSomeDayGroupInput,
    DateProvider,
    SomeDayGroup,
    UpdateSomeDayGroupInput,
} from '@erledigen/shared';
import type { SomeDayGroupRepository } from './SomeDayGroupRepository';

const GROUP_COLUMNS = 'id, name, description, tag, position, created_at';

interface SomeDayGroupRow {
    id: string;
    name: string;
    description: string | null;
    tag: string;
    position: number;
    created_at: string;
}

function mapSomeDayGroupRow(row: SomeDayGroupRow): SomeDayGroup {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        tag: row.tag,
        position: row.position,
        createdAt: row.created_at,
    };
}

export class SqliteSomeDayGroupRepository implements SomeDayGroupRepository {
    constructor(
        private readonly db: Database,
        private readonly dateProvider: DateProvider,
    ) {}

    async findAll(): Promise<SomeDayGroup[]> {
        return this.select('ORDER BY position ASC, created_at ASC');
    }

    async findById(id: string): Promise<SomeDayGroup | null> {
        const rows = this.select('WHERE id = ?', [id]);
        return rows[0] ?? null;
    }

    async create(input: CreateSomeDayGroupInput): Promise<SomeDayGroup> {
        const id = this.nextId();

        this.db
            .prepare(
                `
                INSERT INTO some_day_groups (${GROUP_COLUMNS})
                VALUES (?, ?, ?, ?, ?, ?)
                `,
            )
            .run(
                id,
                input.name,
                input.description ?? null,
                input.tag,
                input.position,
                this.dateProvider.timestamp(),
            );

        const created = await this.findById(id);
        if (created === null) {
            throw new Error(`SomeDayGroup ${id} missing after insert`);
        }
        return created;
    }

    async update(id: string, input: UpdateSomeDayGroupInput): Promise<SomeDayGroup | null> {
        const sets: string[] = [];
        const values: SQLQueryBindings[] = [];

        const assign = (column: string, value: SQLQueryBindings): void => {
            sets.push(`${column} = ?`);
            values.push(value);
        };

        if ('name' in input) assign('name', input.name);
        if ('description' in input) assign('description', input.description);
        if ('tag' in input) assign('tag', input.tag);
        if ('position' in input) assign('position', input.position);

        if (sets.length === 0) return this.findById(id);

        const result = this.db
            .prepare(`UPDATE some_day_groups SET ${sets.join(', ')} WHERE id = ?`)
            .run(...values, id);

        if (result.changes === 0) return null;
        return this.findById(id);
    }

    async delete(id: string): Promise<boolean> {
        const result = this.db.prepare('DELETE FROM some_day_groups WHERE id = ?').run(id);
        return result.changes > 0;
    }

    private select(where: string, params: SQLQueryBindings[] = []): SomeDayGroup[] {
        const rows = this.db
            .prepare(`SELECT ${GROUP_COLUMNS} FROM some_day_groups ${where}`)
            .all(...params) as SomeDayGroupRow[];
        return rows.map(mapSomeDayGroupRow);
    }

    private nextId(): string {
        const row = this.db
            .prepare(
                'SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 AS next FROM some_day_groups',
            )
            .get() as { next: number };
        return String(row.next);
    }
}
