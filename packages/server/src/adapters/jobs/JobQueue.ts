/**
 * Job queue interface (see ADR-002: SQLite-backed job queue)
 *
 * Persistent background jobs: scheduling work for the future, retrying on
 * failure with exponential backoff, and surviving server restarts. The
 * JobRunner service polls the queue and executes jobs; this interface is
 * the adapter seam (SqliteJobQueue today, PgJobQueue when multi-user
 * PostgreSQL arrives -- one container line change, like the repositories).
 *
 * Status semantics:
 * - `pending`  -- scheduled, waiting for its scheduledAt
 * - `running`  -- claimed by a worker
 * - `failed`   -- an attempt failed; scheduledAt points at the next retry
 * - `dead`     -- max attempts exhausted; no automatic retries
 * - `completed`-- finished successfully
 */

/** A queued background job. */
export interface Job {
    id: string;
    /** Handler kind: 'rollover', 'purge-deleted', 'send-reminder', ... */
    type: string;
    /** JSON-safe job-specific data (e.g. { date } for rollover). */
    payload: unknown;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'dead';
    /** ISO 8601 instant when the job becomes due (next retry if failed). */
    scheduledAt: string;
    startedAt: string | null;
    completedAt: string | null;
    attempts: number;
    maxAttempts: number;
    lastError: string | null;
    createdAt: string;
    updatedAt: string;
}

/** Queue depth snapshot for the health endpoint and job gauges (ADR-005). */
export interface JobQueueStats {
    pending: number;
    running: number;
    dead: number;
    /** Pending (or retry-due) jobs grouped by type, for jobs_pending. */
    pendingByType: Record<string, number>;
}

export interface JobQueue {
    /** Queue a job to run at (or after) the given instant. */
    schedule(type: string, payload: unknown, scheduledAt: Date): Promise<Job>;

    /** Remove a not-yet-run job from the queue entirely. */
    cancel(jobId: string): Promise<void>;

    /** Jobs due now (pending, or failed with a due retry), oldest first. */
    getPending(): Promise<Job[]>;

    markRunning(jobId: string): Promise<void>;

    markCompleted(jobId: string): Promise<void>;

    /** Record a failed attempt and reschedule: status becomes `failed`,
     *  attempts increments, and scheduledAt moves to retryAt. */
    markFailed(jobId: string, error: string, retryAt: Date): Promise<void>;

    /** Record the final failure: status `dead`, attempts increments. */
    markDead(jobId: string, error: string): Promise<void>;

    /** Startup recovery (ADR-002): reset jobs stuck in `running` -- e.g. by
     *  a crashed process -- back to `pending` so they re-run. Returns the
     *  number reset. */
    recoverStuckJobs(): Promise<number>;

    /** Queue depth snapshot (health endpoint, jobs gauges). */
    getStats(): Promise<JobQueueStats>;

    /** Recent jobs of one type, most recently scheduled first. The
     *  scheduler uses this to tell whether a recurring job already ran. */
    findRecentByType(type: string, limit: number): Promise<Job[]>;
}
