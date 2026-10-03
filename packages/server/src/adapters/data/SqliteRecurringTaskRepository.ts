/**
 * SQLite-backed RecurringTask persistence (see ADR-001)
 *
 * Implements the RecurringTaskRepository contract (templates + streak stats)
 * with raw SQL via bun:sqlite. Behavioral parity with
 * InMemoryRecurringTaskRepository is enforced by the shared contract test
 * suite (see contracts/recurringTaskRepositoryContract.ts).
 */

import type { Database, SQLQueryBindings } from 'bun:sqlite';
import type {
    CreateRecurringTaskInput,
    DateProvider,
    RecurringTask,
    RecurringTaskStats,
    UpdateRecurringTaskInput,
} from '@erledigen/shared';
import { RECURRING_TASK_DEFAULTS } from '@erledigen/shared';
import type { RecurringTaskRepository } from './RecurringTaskRepository';
import { parseJsonColumn, toBoolean, toInteger } from './sqliteMapping';
import { SqlUpdate } from './sqliteUpdate';

const RECURRING_TASK_COLUMNS = `
    id, text, notes, tags, frequency, interval, days_of_week, day_of_month,
    start_date, end_date, rollover_enabled, start_time, created_at, updated_at
`;

interface RecurringTaskRow {
    id: string;
    text: string;
    notes: string | null;
    tags: string;
    frequency: string;
    interval: number;
    days_of_week: string | null;
    day_of_month: number | null;
    start_date: string;
    end_date: string | null;
    rollover_enabled: number;
    start_time: string | null;
    created_at: string;
    updated_at: string;
}

interface StatsRow {
    recurring_task_id: string;
    current_streak: number;
    longest_streak: number;
    total_completions: number;
    last_completed_date: string | null;
}

function mapRecurringTaskRow(row: RecurringTaskRow): RecurringTask {
    return {
        id: row.id,
        text: row.text,
        notes: row.notes,
        tags: parseJsonColumn<string[]>(row.tags, []),
        frequency: row.frequency as RecurringTask['frequency'],
        interval: row.interval,
        // Corrupt JSON degrades to [] which the scheduler treats as "any
        // day" (same as null): the habit keeps generating rather than
        // crashing reads, and the anomaly is visible in the data.
        daysOfWeek:
            row.days_of_week === null ? null : parseJsonColumn<number[]>(row.days_of_week, []),
        dayOfMonth: row.day_of_month,
        startDate: row.start_date,
        endDate: row.end_date,
        rolloverEnabled: toBoolean(row.rollover_enabled),
        startTime: row.start_time,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function mapStatsRow(row: StatsRow): RecurringTaskStats {
    return {
        recurringTaskId: row.recurring_task_id,
        currentStreak: row.current_streak,
        longestStreak: row.longest_streak,
        totalCompletions: row.total_completions,
        lastCompletedDate: row.last_completed_date,
    };
}

export class SqliteRecurringTaskRepository implements RecurringTaskRepository {
    constructor(
        private readonly db: Database,
        private readonly dateProvider: DateProvider,
    ) {}

    async findAll(): Promise<RecurringTask[]> {
        return this.select('ORDER BY created_at ASC');
    }

    async findById(id: string): Promise<RecurringTask | null> {
        const rows = this.select('WHERE id = ?', [id]);
        return rows[0] ?? null;
    }

    async create(input: CreateRecurringTaskInput): Promise<RecurringTask> {
        const now = this.dateProvider.timestamp();
        const id = this.nextId();

        this.db
            .prepare(
                `
                INSERT INTO recurring_tasks (${RECURRING_TASK_COLUMNS})
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
            )
            .run(
                id,
                input.text,
                input.notes ?? null,
                JSON.stringify(input.tags ?? [...RECURRING_TASK_DEFAULTS.tags]),
                input.frequency,
                input.interval ?? RECURRING_TASK_DEFAULTS.interval,
                input.daysOfWeek ? JSON.stringify(input.daysOfWeek) : null,
                input.dayOfMonth ?? null,
                input.startDate,
                input.endDate ?? null,
                toInteger(input.rolloverEnabled ?? RECURRING_TASK_DEFAULTS.rolloverEnabled),
                input.startTime ?? null,
                now,
                now,
            );

        const created = await this.findById(id);
        if (created === null) {
            throw new Error(`RecurringTask ${id} missing after insert`);
        }
        return created;
    }

    async replaceAll(recurringTasks: RecurringTask[]): Promise<void> {
        this.replaceAllSync(recurringTasks);
        return Promise.resolve();
    }

    /** Synchronous core, for composing multi-table restore transactions
     *  (ADR-009) -- see SqliteTaskRepository.replaceAllSync. */
    replaceAllSync(recurringTasks: RecurringTask[]): void {
        const insert = this.db.prepare(
            `
            INSERT INTO recurring_tasks (${RECURRING_TASK_COLUMNS})
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
        );
        this.db.transaction(() => {
            this.db.prepare('DELETE FROM recurring_tasks').run();
            // Stats are DERIVED data (recomputed from instances on read)
            // and are deliberately absent from the snapshot -- a restore
            // wipes them with the templates. Keeping rows for ids the
            // restore just removed lets a REUSED id inherit a deleted
            // habit's records (nextId frees the max id on delete/
            // restore).
            this.db.prepare('DELETE FROM recurring_task_stats').run();
            for (const rt of recurringTasks) {
                insert.run(
                    rt.id,
                    rt.text,
                    rt.notes,
                    JSON.stringify(rt.tags),
                    rt.frequency,
                    rt.interval,
                    rt.daysOfWeek ? JSON.stringify(rt.daysOfWeek) : null,
                    rt.dayOfMonth,
                    rt.startDate,
                    rt.endDate,
                    toInteger(rt.rolloverEnabled),
                    rt.startTime,
                    rt.createdAt,
                    rt.updatedAt,
                );
            }
        })();
    }

    async update(id: string, input: UpdateRecurringTaskInput): Promise<RecurringTask | null> {
        const patch = new SqlUpdate();

        if ('text' in input) patch.assign('text', input.text);
        if ('notes' in input) patch.assign('notes', input.notes);
        if ('tags' in input) patch.assign('tags', JSON.stringify(input.tags));
        if ('frequency' in input) patch.assign('frequency', input.frequency);
        if ('interval' in input) patch.assign('interval', input.interval);
        if ('daysOfWeek' in input)
            patch.assign(
                'days_of_week',
                input.daysOfWeek ? JSON.stringify(input.daysOfWeek) : null,
            );
        if ('dayOfMonth' in input) patch.assign('day_of_month', input.dayOfMonth);
        if ('startDate' in input) patch.assign('start_date', input.startDate);
        if ('endDate' in input) patch.assign('end_date', input.endDate);
        if ('rolloverEnabled' in input)
            patch.assign('rollover_enabled', toInteger(input.rolloverEnabled));
        if ('startTime' in input) patch.assign('start_time', input.startTime);

        if (patch.isEmpty) return this.findById(id);

        // updatedAt always refreshes, matching InMemoryRecurringTaskRepository.
        patch.assign('updated_at', this.dateProvider.timestamp());

        const result = this.db
            .prepare(`UPDATE recurring_tasks SET ${patch.assignments} WHERE id = ?`)
            .run(...patch.parameters, id);

        if (result.changes === 0) return null;
        return this.findById(id);
    }

    async delete(id: string): Promise<boolean> {
        // The stats row dies with its template (same id-reuse reasoning
        // as replaceAllSync -- deleting the max id frees it for reuse).
        this.db.prepare('DELETE FROM recurring_task_stats WHERE recurring_task_id = ?').run(id);
        const result = this.db.prepare('DELETE FROM recurring_tasks WHERE id = ?').run(id);
        return result.changes > 0;
    }

    async findStats(recurringTaskId: string): Promise<RecurringTaskStats | null> {
        const row = this.db
            .prepare(
                `
                SELECT recurring_task_id, current_streak, longest_streak,
                       total_completions, last_completed_date
                FROM recurring_task_stats
                WHERE recurring_task_id = ?
                `,
            )
            .get(recurringTaskId) as StatsRow | null;
        return row ? mapStatsRow(row) : null;
    }

    async upsertStats(stats: RecurringTaskStats): Promise<void> {
        this.db
            .prepare(
                `
                INSERT INTO recurring_task_stats
                    (recurring_task_id, current_streak, longest_streak,
                     total_completions, last_completed_date)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(recurring_task_id) DO UPDATE SET
                    current_streak = excluded.current_streak,
                    longest_streak = excluded.longest_streak,
                    total_completions = excluded.total_completions,
                    last_completed_date = excluded.last_completed_date
                `,
            )
            .run(
                stats.recurringTaskId,
                stats.currentStreak,
                stats.longestStreak,
                stats.totalCompletions,
                stats.lastCompletedDate,
            );
    }

    private select(where: string, params: SQLQueryBindings[] = []): RecurringTask[] {
        const rows = this.db
            .prepare(`SELECT ${RECURRING_TASK_COLUMNS} FROM recurring_tasks ${where}`)
            .all(...params) as RecurringTaskRow[];
        return rows.map(mapRecurringTaskRow);
    }

    private nextId(): string {
        const row = this.db
            .prepare(
                'SELECT COALESCE(MAX(CAST(id AS INTEGER)), 0) + 1 AS next FROM recurring_tasks',
            )
            .get() as { next: number };
        return String(row.next);
    }
}
