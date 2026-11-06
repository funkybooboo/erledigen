/**
 * SQLite-backed SomedayTab persistence (see ADR-001)
 *
 * Implements the SomedayTabRepository contract with raw SQL via bun:sqlite.
 * Behavioral parity with InMemorySomedayTabRepository is enforced by the
 * shared contract test suite (see contracts/somedayTabRepositoryContract.ts).
 */

import type { Database, SQLQueryBindings } from 'bun:sqlite';
import type {
    CreateSomedayTabInput,
    DateProvider,
    SomedayTab,
    UpdateSomedayTabInput,
} from '@erledigen/shared';
import { DEFAULT_SOMEDAY_TAB_ID } from '@erledigen/shared';
import type { SomedayTabRepository } from './SomedayTabRepository';
import { SqlUpdate } from './sqliteUpdate';

const TAB_COLUMNS = 'id, name, position, project_tag, created_at';

interface SomedayTabRow {
    id: string;
    name: string;
    position: number;
    project_tag: string | null;
    created_at: string;
}

function mapSomedayTabRow(row: SomedayTabRow): SomedayTab {
    return {
        id: row.id,
        name: row.name,
        position: row.position,
        projectTag: row.project_tag,
        createdAt: row.created_at,
    };
}

export class SqliteSomedayTabRepository implements SomedayTabRepository {
    constructor(
        private readonly db: Database,
        private readonly dateProvider: DateProvider,
    ) {}

    async findAll(): Promise<SomedayTab[]> {
        return this.select('ORDER BY position ASC, created_at ASC');
    }

    async findById(id: string): Promise<SomedayTab | null> {
        const rows = this.select('WHERE id = ?', [id]);
        return rows[0] ?? null;
    }

    async create(input: CreateSomedayTabInput): Promise<SomedayTab> {
        const id = this.nextId();

        this.db
            .prepare(
                `
                INSERT INTO someday_tabs (${TAB_COLUMNS})
                VALUES (?, ?, ?, ?, ?)
                `,
            )
            .run(
                id,
                input.name,
                input.position,
                input.projectTag ?? null,
                this.dateProvider.timestamp(),
            );

        const created = await this.findById(id);
        if (created === null) {
            throw new Error(`SomedayTab ${id} missing after insert`);
        }
        return created;
    }

    async replaceAll(tabs: SomedayTab[]): Promise<void> {
        this.replaceAllSync(tabs);
        return Promise.resolve();
    }

    /** Synchronous core, for composing multi-table restore transactions
     *  (ADR-009) -- see SqliteTaskRepository.replaceAllSync. The default
     *  tab is re-seeded when the snapshot lacks it: every install owns it
     *  (unlisted parked tasks render there), so a verbatim replace never
     *  leaves the app without its catch-all (USE-16). */
    replaceAllSync(tabs: SomedayTab[]): void {
        const insert = this.db.prepare(
            `
            INSERT INTO someday_tabs (${TAB_COLUMNS})
            VALUES (?, ?, ?, ?, ?)
            `,
        );
        this.db.transaction(() => {
            this.db.prepare('DELETE FROM someday_tabs').run();
            for (const tab of tabs) {
                insert.run(tab.id, tab.name, tab.position, tab.projectTag, tab.createdAt);
            }
            if (!tabs.some(t => t.id === DEFAULT_SOMEDAY_TAB_ID)) {
                insert.run(
                    DEFAULT_SOMEDAY_TAB_ID,
                    'Someday',
                    0,
                    null,
                    this.dateProvider.timestamp(),
                );
            }
        })();
    }

    async update(id: string, input: UpdateSomedayTabInput): Promise<SomedayTab | null> {
        const patch = new SqlUpdate();

        if ('name' in input) patch.assign('name', input.name);
        if ('position' in input) patch.assign('position', input.position);
        if ('projectTag' in input) patch.assign('project_tag', input.projectTag);

        if (patch.isEmpty) return this.findById(id);

        const result = this.db
            .prepare(`UPDATE someday_tabs SET ${patch.assignments} WHERE id = ?`)
            .run(...patch.parameters, id);

        if (result.changes === 0) return null;
        return this.findById(id);
    }

    async delete(id: string): Promise<boolean> {
        const result = this.db.prepare('DELETE FROM someday_tabs WHERE id = ?').run(id);
        return result.changes > 0;
    }

    private select(where: string, params: SQLQueryBindings[] = []): SomedayTab[] {
        const rows = this.db
            .prepare(`SELECT ${TAB_COLUMNS} FROM someday_tabs ${where}`)
            .all(...params) as SomedayTabRow[];
        return rows.map(mapSomedayTabRow);
    }

    private nextId(): string {
        const row = this.db
            .prepare('SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 AS next FROM someday_tabs')
            .get() as { next: number };
        return String(row.next);
    }
}
