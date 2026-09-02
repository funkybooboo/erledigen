/**
 * SQLite-backed Task persistence (see ADR-001)
 *
 * Implements the TaskRepository contract with raw SQL via bun:sqlite.
 * Behavioral parity with InMemoryTaskRepository is enforced by the shared
 * contract test suite (see contracts/taskRepositoryContract.ts).
 */

import type { Database, SQLQueryBindings } from 'bun:sqlite';
import type { CreateTaskInput, DateProvider, Task, UpdateTaskInput } from '@erledigen/shared';
import { PURGE_RETENTION_DAYS, TASK_DEFAULTS } from '@erledigen/shared';
import { parseJsonColumn, toBoolean, toInteger } from './sqliteMapping';
import type { TaskRepository } from './TaskRepository';

const TASK_COLUMNS = `
    id, text, notes, completed, date, created_at, updated_at, tags,
    parent_id, rollover_enabled, some_day_group_id, position, state,
    recurring_task_id, instance_date, original_scheduled_date, days_late,
    depends_on, start_time, end_time, reminder, deleted_at
`;

interface TaskRow {
    id: string;
    text: string;
    notes: string | null;
    completed: number;
    date: string | null;
    created_at: string;
    updated_at: string;
    tags: string;
    parent_id: string | null;
    rollover_enabled: number;
    some_day_group_id: string | null;
    position: number | null;
    state: string | null;
    recurring_task_id: string | null;
    instance_date: string | null;
    original_scheduled_date: string | null;
    days_late: number;
    depends_on: string | null;
    start_time: string | null;
    end_time: string | null;
    reminder: string | null;
    deleted_at: string | null;
}

function mapTaskRow(row: TaskRow): Task {
    return {
        id: row.id,
        text: row.text,
        notes: row.notes,
        completed: toBoolean(row.completed),
        date: row.date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        tags: parseJsonColumn<string[]>(row.tags, []),
        parentId: row.parent_id,
        rolloverEnabled: toBoolean(row.rollover_enabled),
        someDayGroupId: row.some_day_group_id,
        position: row.position,
        state: (row.state as Task['state']) ?? null,
        recurringTaskId: row.recurring_task_id,
        instanceDate: row.instance_date,
        originalScheduledDate: row.original_scheduled_date,
        daysLate: row.days_late,
        dependsOn: row.depends_on,
        startTime: row.start_time,
        endTime: row.end_time,
        reminder: parseJsonColumn<Task['reminder']>(row.reminder, null),
        deletedAt: row.deleted_at,
    };
}

export class SqliteTaskRepository implements TaskRepository {
    constructor(
        private readonly db: Database,
        private readonly dateProvider: DateProvider,
    ) {}

    async findAll(): Promise<Task[]> {
        return this.select(
            'WHERE deleted_at IS NULL ORDER BY date IS NULL ASC, date ASC, created_at ASC',
        );
    }

    async findByDate(date: string): Promise<Task[]> {
        return this.select('WHERE deleted_at IS NULL AND date = ? ORDER BY created_at ASC', [date]);
    }

    async findById(id: string): Promise<Task | null> {
        const rows = this.select('WHERE id = ? AND deleted_at IS NULL', [id]);
        return rows[0] ?? null;
    }

    async create(input: CreateTaskInput): Promise<Task> {
        const now = this.dateProvider.timestamp();
        const id = this.nextId();

        this.db
            .prepare(
                `
                INSERT INTO tasks (${TASK_COLUMNS})
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
            )
            .run(
                id,
                input.text,
                input.notes ?? null,
                toInteger(false),
                input.date,
                now,
                now,
                JSON.stringify(input.tags ?? [...TASK_DEFAULTS.tags]),
                input.parentId ?? null,
                toInteger(input.rolloverEnabled ?? TASK_DEFAULTS.rolloverEnabled),
                input.someDayGroupId ?? null,
                input.position ?? null,
                input.state ?? null,
                input.recurringTaskId ?? null,
                input.instanceDate ?? null,
                null,
                0,
                null,
                input.startTime ?? null,
                input.endTime ?? null,
                input.reminder ? JSON.stringify(input.reminder) : null,
                null,
            );

        const created = await this.findById(id);
        if (created === null) {
            throw new Error(`Task ${id} missing after insert`);
        }
        return created;
    }

    async update(id: string, input: UpdateTaskInput): Promise<Task | null> {
        const sets: string[] = [];
        const values: SQLQueryBindings[] = [];

        const assign = (column: string, value: SQLQueryBindings): void => {
            sets.push(`${column} = ?`);
            values.push(value);
        };

        if ('text' in input) assign('text', input.text);
        if ('notes' in input) assign('notes', input.notes);
        if ('completed' in input) assign('completed', toInteger(input.completed));
        if ('date' in input) assign('date', input.date);
        if ('tags' in input) assign('tags', JSON.stringify(input.tags));
        if ('parentId' in input) assign('parent_id', input.parentId);
        if ('someDayGroupId' in input) assign('some_day_group_id', input.someDayGroupId);
        if ('rolloverEnabled' in input)
            assign('rollover_enabled', toInteger(input.rolloverEnabled));
        if ('position' in input) assign('position', input.position);
        if ('state' in input) assign('state', input.state);
        if ('startTime' in input) assign('start_time', input.startTime);
        if ('endTime' in input) assign('end_time', input.endTime);
        if ('reminder' in input) {
            assign('reminder', input.reminder ? JSON.stringify(input.reminder) : null);
        }

        // updatedAt always refreshes, even when no other field is provided
        // (matches InMemoryTaskRepository spread semantics).
        assign('updated_at', this.dateProvider.timestamp());

        const result = this.db
            .prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`)
            .run(...values, id);

        if (result.changes === 0) return null;
        return this.findById(id);
    }

    async delete(id: string): Promise<boolean> {
        const now = this.dateProvider.timestamp();
        const result = this.db
            .prepare(
                'UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
            )
            .run(now, now, id);
        return result.changes > 0;
    }

    async forceDelete(id: string): Promise<boolean> {
        const result = this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
        return result.changes > 0;
    }

    async restore(id: string): Promise<Task | null> {
        const result = this.db
            .prepare(
                'UPDATE tasks SET deleted_at = NULL, updated_at = ? WHERE id = ? AND deleted_at IS NOT NULL',
            )
            .run(this.dateProvider.timestamp(), id);

        if (result.changes === 0) return null;
        return this.findById(id);
    }

    async findDeleted(maxAgeDays: number = PURGE_RETENTION_DAYS): Promise<Task[]> {
        // Note: the retention window is NOT applied here, matching
        // InMemoryTaskRepository -- findDeleted returns the full trash list;
        // only purgeDeleted enforces the cutoff.
        void maxAgeDays;
        return this.select('WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC');
    }

    async purgeDeleted(maxAgeDays: number = PURGE_RETENTION_DAYS): Promise<number> {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - maxAgeDays);
        const result = this.db
            .prepare('DELETE FROM tasks WHERE deleted_at IS NOT NULL AND deleted_at < ?')
            .run(cutoff.toISOString());
        return result.changes;
    }

    async findSomeday(): Promise<Task[]> {
        return this.select('WHERE deleted_at IS NULL AND date IS NULL ORDER BY created_at ASC');
    }

    async findBySomeDayGroup(groupId: string): Promise<Task[]> {
        return this.select(
            'WHERE deleted_at IS NULL AND some_day_group_id = ? ORDER BY created_at ASC',
            [groupId],
        );
    }

    async findByRecurringTaskId(recurringTaskId: string): Promise<Task[]> {
        return this.select(
            'WHERE deleted_at IS NULL AND recurring_task_id = ? ORDER BY date ASC, created_at ASC',
            [recurringTaskId],
        );
    }

    async findChildren(parentId: string): Promise<Task[]> {
        return this.select('WHERE deleted_at IS NULL AND parent_id = ? ORDER BY created_at ASC', [
            parentId,
        ]);
    }

    async findByTags(tags: string[]): Promise<Task[]> {
        if (tags.length === 0) return this.findAll();

        const placeholders = tags.map(() => '?').join(', ');
        return this.select(
            `WHERE deleted_at IS NULL
             AND EXISTS (
                 SELECT 1 FROM json_each(tasks.tags)
                 WHERE json_each.value IN (${placeholders})
             )
             ORDER BY created_at ASC`,
            tags,
        );
    }

    private select(where: string, params: SQLQueryBindings[] = []): Task[] {
        const rows = this.db
            .prepare(`SELECT ${TASK_COLUMNS} FROM tasks ${where}`)
            .all(...params) as TaskRow[];
        return rows.map(mapTaskRow);
    }

    /**
     * Sequential numeric ids ("1", "2", ...), matching the in-memory adapter.
     * All ids in this schema are generated numeric strings, so the CAST is
     * safe; bun:sqlite is synchronous so there is no read-modify-write race.
     */
    private nextId(): string {
        const row = this.db
            .prepare('SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 AS next FROM tasks')
            .get() as { next: number };
        return String(row.next);
    }
}
