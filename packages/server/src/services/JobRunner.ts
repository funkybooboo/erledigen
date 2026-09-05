/**
 * Job runner service (see ADR-002)
 *
 * Polls the JobQueue every pollIntervalMs and executes due jobs
 * sequentially (single worker, concurrency 1 -- matching the single-user
 * workload). On failure: exponential backoff (2^attempts * retryBaseDelayMs)
 * and, after maxAttempts, a dead-letter `dead` status with no automatic
 * retries. Every execution logs through a child logger carrying
 * jobId/jobType (ADR-004) and records the job metrics (ADR-005).
 */

import type { Logger, MetricsAdapter } from '@erledigen/shared';
import {
    JOB_DURATION_SECONDS,
    JOBS_PENDING,
    JOBS_RUNNING,
    JOBS_TOTAL,
    RequestLogger,
} from '@erledigen/shared';
import type { Job, JobQueue } from '../adapters/jobs/JobQueue';

/** A handler for one job type. */
export interface JobHandler {
    handle(job: Job): Promise<void>;
}

export interface JobRunnerConfig {
    /** Poll interval in ms (JOB_POLL_INTERVAL_MS, default 1000). */
    pollIntervalMs: number;
    /** Backoff base delay in ms (JOB_RETRY_BASE_DELAY_MS, default 5000):
     *  after the Nth failed attempt the retry waits 2^N * base. */
    retryBaseDelayMs: number;
    /** Per-attempt timeout in ms (JOB_TIMEOUT_MS, default 30000). */
    timeoutMs: number;
}

export const DEFAULT_JOB_RUNNER_CONFIG: JobRunnerConfig = {
    pollIntervalMs: 1000,
    retryBaseDelayMs: 5000,
    timeoutMs: 30_000,
};

type AttemptOutcome = { kind: 'ok' } | { kind: 'timeout' } | { kind: 'error'; error: unknown };

function describeError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

export class JobRunner {
    private handlers = new Map<string, JobHandler>();
    private timer: ReturnType<typeof setInterval> | null = null;
    private polling = false;
    private inFlight: Promise<void> | null = null;
    private started = false;
    /** Set by stop() so a cycle in flight stops before starting the next
     *  job. (Distinct from `started`: manual pollOnce() cycles are legal
     *  before start(), e.g. in tests and kick().) */
    private stopping = false;
    /** Every job type ever seen in the gauges -- so a drained type goes to
     *  0 instead of keeping a stale pending value. */
    private seenTypes = new Set<string>();

    constructor(
        private readonly jobQueue: JobQueue,
        private readonly logger: Logger,
        private readonly metrics: MetricsAdapter,
        private readonly config: JobRunnerConfig = DEFAULT_JOB_RUNNER_CONFIG,
    ) {}

    /** Register the handler for a job type. Handlers should be registered
     *  before start(); jobs whose type has no handler stay pending. */
    register(type: string, handler: JobHandler): void {
        this.handlers.set(type, handler);
    }

    /**
     * Begin polling. First resets jobs left `running` by a previous
     * crashed process back to pending (startup recovery, ADR-002), then
     * polls every pollIntervalMs.
     */
    async start(): Promise<void> {
        if (this.started) return;
        this.started = true;
        const stuck = await this.jobQueue.recoverStuckJobs();
        if (stuck > 0) {
            this.logger.warn('Recovered stuck jobs after restart', { count: stuck });
        }
        this.timer = setInterval(() => {
            void this.pollOnce();
        }, this.config.pollIntervalMs);
    }

    /**
     * Stop polling. A job already executing is awaited to completion
     * (ADR-002: "waits for current job"); no new job is started.
     */
    async stop(): Promise<void> {
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
        // Flip first so a cycle in flight stops before starting the next job.
        this.started = false;
        this.stopping = true;
        if (this.inFlight !== null) await this.inFlight;
        this.stopping = false;
    }

    /**
     * Run one poll cycle now. Used by the interval, by kick(), and by
     * tests. Re-entrant calls are ignored while a cycle is in flight.
     */
    async pollOnce(): Promise<void> {
        if (this.polling) return;
        this.polling = true;
        this.inFlight = this.cycle();
        try {
            await this.inFlight;
        } finally {
            this.polling = false;
            this.inFlight = null;
        }
    }

    /**
     * Trigger a poll soon instead of waiting for the next tick -- for
     * latency-sensitive scheduling (ADR-002): the code that just queued a
     * job can ask for immediate processing.
     */
    kick(): void {
        void this.pollOnce();
    }

    private async cycle(): Promise<void> {
        try {
            const due = await this.jobQueue.getPending();
            for (const job of due) {
                // stop() mid-cycle: finish the current job, start no new one.
                if (this.stopping) break;
                await this.runJob(job);
            }
            await this.recordGauges();
        } catch (error) {
            this.logger.warn('Job poll cycle failed', { error: describeError(error) });
        }
    }

    private async runJob(job: Job): Promise<void> {
        // Types seen here are drained to 0 in the end-of-cycle gauge pass,
        // even when they complete within their first cycle.
        this.seenTypes.add(job.type);

        const handler = this.handlers.get(job.type);
        if (!handler) {
            // Not an error: the job stays pending and reappears on later
            // polls (its handler may be registered later in startup).
            this.logger.warn('No handler registered for job; leaving pending', {
                jobId: job.id,
                jobType: job.type,
            });
            return;
        }

        await this.jobQueue.markRunning(job.id);
        const jobLogger = new RequestLogger(this.logger, { jobId: job.id, jobType: job.type });
        jobLogger.debug('Job started', { attempts: job.attempts + 1 });

        const startedAt = performance.now();
        const outcome = await this.attempt(handler, job);
        const durationSeconds = (performance.now() - startedAt) / 1000;
        this.metrics.observeHistogram(JOB_DURATION_SECONDS, { type: job.type }, durationSeconds);

        if (outcome.kind === 'ok') {
            await this.jobQueue.markCompleted(job.id);
            this.metrics.incrementCounter(JOBS_TOTAL, { type: job.type, status: 'completed' });
            jobLogger.info('Job completed', { durationSeconds });
            return;
        }

        const attempts = job.attempts + 1;
        const errorMessage =
            outcome.kind === 'timeout'
                ? `Timed out after ${this.config.timeoutMs}ms`
                : describeError(outcome.error);

        if (attempts >= job.maxAttempts) {
            await this.jobQueue.markDead(job.id, errorMessage);
            this.metrics.incrementCounter(JOBS_TOTAL, { type: job.type, status: 'dead' });
            jobLogger.error('Job died after max attempts', new Error(errorMessage), {
                attempts,
                maxAttempts: job.maxAttempts,
            });
            return;
        }

        const retryAt = new Date(Date.now() + 2 ** attempts * this.config.retryBaseDelayMs);
        await this.jobQueue.markFailed(job.id, errorMessage, retryAt);
        this.metrics.incrementCounter(JOBS_TOTAL, { type: job.type, status: 'failed' });
        jobLogger.warn('Job failed; retrying with backoff', {
            attempts,
            maxAttempts: job.maxAttempts,
            retryAt: retryAt.toISOString(),
            error: errorMessage,
        });
    }

    /** Runs one attempt with a timeout. Never produces an unhandled
     *  rejection: a handler that rejects after the timeout resolved the
     *  race is captured, not thrown into the void. */
    private async attempt(handler: JobHandler, job: Job): Promise<AttemptOutcome> {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let failure: unknown = null;
        try {
            const handled = handler.handle(job).then(
                () => 'ok' as const,
                (error: unknown) => {
                    failure = error;
                    return 'error' as const;
                },
            );
            const timeout = new Promise<'timeout'>(resolve => {
                timer = setTimeout(() => resolve('timeout'), this.config.timeoutMs);
            });
            const result = await Promise.race([handled, timeout]);
            if (result === 'error') return { kind: 'error', error: failure };
            return { kind: result };
        } finally {
            if (timer !== undefined) clearTimeout(timer);
        }
    }

    private async recordGauges(): Promise<void> {
        const stats = await this.jobQueue.getStats();
        this.metrics.setGauge(JOBS_RUNNING, {}, stats.running);
        for (const type of Object.keys(stats.pendingByType)) {
            this.seenTypes.add(type);
        }
        for (const type of this.seenTypes) {
            this.metrics.setGauge(JOBS_PENDING, { type }, stats.pendingByType[type] ?? 0);
        }
    }
}
