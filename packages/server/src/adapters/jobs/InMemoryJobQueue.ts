/**
 * In-memory job queue (see ADR-002)
 *
 * Ephemeral counterpart to SqliteJobQueue for STORAGE_ADAPTER=memory runs
 * (tests, ephemeral containers). Behavioral parity is enforced by the shared
 * contract suite (contracts/jobQueueContract.ts). Jobs do not survive the
 * process -- which is exactly the memory adapter's contract for every
 * entity.
 */

import type { DateProvider } from '@erledigen/shared';
import type { Job, JobQueue, JobQueueStats } from './JobQueue';

export class InMemoryJobQueue implements JobQueue {
    private jobs = new Map<string, Job>();
    private idCounter = 0;

    constructor(
        private readonly dateProvider: DateProvider,
        private readonly defaultMaxAttempts = 3,
    ) {}

    async schedule(type: string, payload: unknown, scheduledAt: Date): Promise<Job> {
        this.idCounter++;
        const now = this.dateProvider.timestamp();
        const job: Job = {
            id: `job_${this.idCounter}`,
            type,
            payload,
            status: 'pending',
            scheduledAt: scheduledAt.toISOString(),
            startedAt: null,
            completedAt: null,
            attempts: 0,
            maxAttempts: this.defaultMaxAttempts,
            lastError: null,
            createdAt: now,
            updatedAt: now,
        };
        this.jobs.set(job.id, job);
        return { ...job };
    }

    async cancel(jobId: string): Promise<void> {
        const job = this.jobs.get(jobId);
        if (job !== undefined && (job.status === 'pending' || job.status === 'failed')) {
            this.jobs.delete(jobId);
        }
    }

    async getPending(): Promise<Job[]> {
        const nowIso = new Date().toISOString();
        return [...this.jobs.values()]
            .filter(
                job =>
                    (job.status === 'pending' || job.status === 'failed') &&
                    job.scheduledAt <= nowIso,
            )
            .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
            .map(job => ({ ...job }));
    }

    async markRunning(jobId: string): Promise<void> {
        const job = this.require(jobId);
        job.status = 'running';
        job.startedAt = this.dateProvider.timestamp();
        this.touch(job);
    }

    async markCompleted(jobId: string): Promise<void> {
        const job = this.require(jobId);
        job.status = 'completed';
        job.completedAt = this.dateProvider.timestamp();
        this.touch(job);
    }

    async markFailed(jobId: string, error: string, retryAt: Date): Promise<void> {
        const job = this.require(jobId);
        job.status = 'failed';
        job.attempts += 1;
        job.lastError = error;
        job.scheduledAt = retryAt.toISOString();
        this.touch(job);
    }

    async markDead(jobId: string, error: string): Promise<void> {
        const job = this.require(jobId);
        job.status = 'dead';
        job.attempts += 1;
        job.lastError = error;
        this.touch(job);
    }

    async recoverStuckJobs(): Promise<number> {
        let reset = 0;
        for (const job of this.jobs.values()) {
            if (job.status === 'running') {
                job.status = 'pending';
                this.touch(job);
                reset++;
            }
        }
        return reset;
    }

    async getStats(): Promise<JobQueueStats> {
        const stats: JobQueueStats = { pending: 0, running: 0, dead: 0, pendingByType: {} };
        for (const job of this.jobs.values()) {
            if (job.status === 'pending' || job.status === 'failed') {
                stats.pending += 1;
                stats.pendingByType[job.type] = (stats.pendingByType[job.type] ?? 0) + 1;
            } else if (job.status === 'running') {
                stats.running += 1;
            } else if (job.status === 'dead') {
                stats.dead += 1;
            }
        }
        return stats;
    }

    async findRecentByType(type: string, limit: number): Promise<Job[]> {
        return [...this.jobs.values()]
            .filter(job => job.type === type)
            .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
            .slice(0, limit)
            .map(job => ({ ...job }));
    }

    private require(jobId: string): Job {
        const job = this.jobs.get(jobId);
        if (job === undefined) throw new Error(`Job ${jobId} not found`);
        return job;
    }

    private touch(job: Job): void {
        job.updatedAt = this.dateProvider.timestamp();
    }
}
