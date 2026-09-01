/**
 * SQLite-backed Project persistence (see ADR-001)
 *
 * Implements the ProjectRepository contract with raw SQL via bun:sqlite.
 * Behavioral parity with InMemoryProjectRepository is enforced by the shared
 * contract test suite (see contracts/projectRepositoryContract.ts).
 */

import type { Database, SQLQueryBindings } from 'bun:sqlite';
import type {
    CreateProjectInput,
    DateProvider,
    Project,
    UpdateProjectInput,
} from '@erledigen/shared';
import { slugify } from '@erledigen/shared';
import type { ProjectRepository } from './ProjectRepository';
import { toBoolean, toInteger } from './sqliteMapping';

const PROJECT_COLUMNS =
    'id, name, tag, description, start_date, due_date, is_active, created_at, completed_at';

interface ProjectRow {
    id: string;
    name: string;
    tag: string;
    description: string | null;
    start_date: string | null;
    due_date: string | null;
    is_active: number;
    created_at: string;
    completed_at: string | null;
}

function mapProjectRow(row: ProjectRow): Project {
    return {
        id: row.id,
        name: row.name,
        tag: row.tag,
        description: row.description,
        startDate: row.start_date,
        dueDate: row.due_date,
        isActive: toBoolean(row.is_active),
        createdAt: row.created_at,
        completedAt: row.completed_at,
    };
}

export class SqliteProjectRepository implements ProjectRepository {
    constructor(
        private readonly db: Database,
        private readonly dateProvider: DateProvider,
    ) {}

    async findAll(): Promise<Project[]> {
        return this.select('ORDER BY created_at ASC');
    }

    async findActive(): Promise<Project[]> {
        return this.select('WHERE is_active = 1 ORDER BY created_at ASC');
    }

    async findById(id: string): Promise<Project | null> {
        const rows = this.select('WHERE id = ?', [id]);
        return rows[0] ?? null;
    }

    async create(input: CreateProjectInput): Promise<Project> {
        const id = this.nextId();
        const tag = input.tag ?? `project:${slugify(input.name)}`;

        this.db
            .prepare(
                `
                INSERT INTO projects (${PROJECT_COLUMNS})
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
            )
            .run(
                id,
                input.name,
                tag,
                input.description ?? null,
                input.startDate ?? null,
                input.dueDate ?? null,
                toInteger(true),
                this.dateProvider.timestamp(),
                null,
            );

        const created = await this.findById(id);
        if (created === null) {
            throw new Error(`Project ${id} missing after insert`);
        }
        return created;
    }

    async update(id: string, input: UpdateProjectInput): Promise<Project | null> {
        const sets: string[] = [];
        const values: SQLQueryBindings[] = [];

        const assign = (column: string, value: SQLQueryBindings): void => {
            sets.push(`${column} = ?`);
            values.push(value);
        };

        if ('name' in input) assign('name', input.name);
        if ('tag' in input) assign('tag', input.tag);
        if ('description' in input) assign('description', input.description);
        if ('startDate' in input) assign('start_date', input.startDate);
        if ('dueDate' in input) assign('due_date', input.dueDate);
        if ('isActive' in input) assign('is_active', toInteger(input.isActive));
        if ('completedAt' in input) assign('completed_at', input.completedAt);

        if (sets.length === 0) return this.findById(id);

        const result = this.db
            .prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`)
            .run(...values, id);

        if (result.changes === 0) return null;
        return this.findById(id);
    }

    async delete(id: string): Promise<boolean> {
        const result = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
        return result.changes > 0;
    }

    private select(where: string, params: SQLQueryBindings[] = []): Project[] {
        const rows = this.db
            .prepare(`SELECT ${PROJECT_COLUMNS} FROM projects ${where}`)
            .all(...params) as ProjectRow[];
        return rows.map(mapProjectRow);
    }

    private nextId(): string {
        const row = this.db
            .prepare('SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 AS next FROM projects')
            .get() as { next: number };
        return String(row.next);
    }
}
