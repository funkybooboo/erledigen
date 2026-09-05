/**
 * SQLite-backed job queue (see ADR-002)
 *
 * The jobs table lives in the same database as the application data
 * (migration 004). bun:sqlite is synchronous, so no locking is needed for
 * the single-worker poll loop. Behavioral parity with InMemoryJobQueue is
 * enforced by the shared contract suite (contracts/jobQueueContract.ts).
 */

import type { Database } from 'bun:sqlite';
import type { DateProvider } from '@erledigen/shared';
import type { Job, JobQueue, JobQueueStats } from './JobQueue';

interface JobRow {
    id: string;
    type: string;
    payload: string;
    status: Job['status'];
    scheduled_at: string;
    started_at: string | null;
    completed_at: string | null;
    attempts: number;
    max_attempts: number;
    last_error: string | null;
    created_at: string;
    updated_at: string;
}

const JOB_COLUMNS = `
    id, type, payload, status, scheduled_at, started_at, completed_at,
    attempts, max_attempts, last_error, created_at, updated_at
`;

/** Parses a payload column; the schema declares payload NOT NULL. */
function parsePayload(raw: string): unknown {
    return JSON.parse(raw) as unknown;
}

export class SqliteJobQueue implements JobQueue {
    constructor(
        private readonly db: Database,
        private readonly dateProvider: DateProvider,
        private readonly defaultMaxAttempts = 3,
    ) {}

    async schedule(type: string, payload: unknown, scheduledAt: Date): Promise<Job> {
        const now = this.dateProvider.timestamp();
        const id = crypto.randomUUID();
        this.db
            .prepare(
                `INSERT INTO jobs (${JOB_COLUMNS})
                 VALUES (?, ?, ?, 'pending', ?, NULL, NULL, 0, ?, NULL, ?, ?)`,
            )
            .run(
                id,
                type,
                JSON.stringify(payload),
                scheduledAt.toISOString(),
                this.defaultMaxAttempts,
                now,
                now,
            );
        const job = await this.findById(id);
        if (job === null) throw new Error(`Job ${id} missing after insert`);
        return job;
    }

    async cancel(jobId: string): Promise<void> {
        this.db
            .prepare('DELETE FROM jobs WHERE id = ? AND status IN (?, ?)')
            .run(jobId, 'pending', 'failed');
    }

    async getPending(): Promise<Job[]> {
        const rows = this.db
            .prepare(
                `SELECT ${JOB_COLUMNS} FROM jobs
                 WHERE status IN ('pending', 'failed') AND scheduled_at <= ?
                 ORDER BY scheduled_at ASC`,
            )
            .all(new Date().toISOString()) as unknown as JobRow[];
        return rows.map(mapJobRow);
    }

    async markRunning(jobId: string): Promise<void> {
        this.db
            .prepare(
                "UPDATE jobs SET status = 'running', started_at = ?, updated_at = ? WHERE id = ?",
            )
            .run(this.dateProvider.timestamp(), this.dateProvider.timestamp(), jobId);
    }

    async markCompleted(jobId: string): Promise<void> {
        this.db
            .prepare(
                "UPDATE jobs SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?",
            )
            .run(this.dateProvider.timestamp(), this.dateProvider.timestamp(), jobId);
    }

    async markFailed(jobId: string, error: string, retryAt: Date): Promise<void> {
        this.db
            .prepare(
                `UPDATE jobs SET status = 'failed', attempts = attempts + 1,
                 last_error = ?, scheduled_at = ?, updated_at = ? WHERE id = ?`,
            )
            .run(error, retryAt.toISOString(), this.dateProvider.timestamp(), jobId);
    }

    async markDead(jobId: string, error: string): Promise<void> {
        this.db
            .prepare(
                `UPDATE jobs SET status = 'dead', attempts = attempts + 1,
                 last_error = ?, updated_at = ? WHERE id = ?`,
            )
            .run(error, this.dateProvider.timestamp(), jobId);
    }

    async recoverStuckJobs(): Promise<number> {
        const result = this.db
            .prepare("UPDATE jobs SET status = 'pending', updated_at = ? WHERE status = 'running'")
            .run(this.dateProvider.timestamp());
        return result.changes;
    }

    async getStats(): Promise<JobQueueStats> {
        const rows = this.db
            .prepare(
                `SELECT status, type, COUNT(*) AS n FROM jobs
                 WHERE status IN ('pending', 'failed', 'running', 'dead')
                 GROUP BY status, type`,
            )
            .all() as unknown as Array<{ status: string; type: string; n: number }>;

        const stats: JobQueueStats = { pending: 0, running: 0, dead: 0, pendingByType: {} };
        for (const row of rows) {
            if (row.status === 'pending' || row.status === 'failed') {
                stats.pending += row.n;
                stats.pendingByType[row.type] = (stats.pendingByType[row.type] ?? 0) + row.n;
            } else if (row.status === 'running') {
                stats.running += row.n;
            } else if (row.status === 'dead') {
                stats.dead += row.n;
            }
        }
        return stats;
    }

    async findRecentByType(type: string, limit: number): Promise<Job[]> {
        const rows = this.db
            .prepare(
                `SELECT ${JOB_COLUMNS} FROM jobs WHERE type = ?
                 ORDER BY scheduled_at DESC LIMIT ?`,
            )
            .all(type, limit) as unknown as JobRow[];
        return rows.map(mapJobRow);
    }

    private async findById(id: string): Promise<Job | null> {
        const row = this.db
            .prepare(`SELECT ${JOB_COLUMNS} FROM jobs WHERE id = ?`)
            .get(id) as unknown as JobRow | null;
        return row === null ? null : mapJobRow(row);
    }
}

function mapJobRow(row: JobRow): Job {
    return {
        id: row.id,
        type: row.type,
        payload: parsePayload(row.payload),
        status: row.status,
        scheduledAt: row.scheduled_at,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
        lastError: row.last_error,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
