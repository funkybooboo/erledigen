import { describe, expect, it } from 'bun:test';
import {
    ConsoleLogger,
    type LoggerDestination,
    LogLevel,
    NativeDateProvider,
    PrometheusMetricsAdapter,
} from '@erledigen/shared';
import { InMemoryJobQueue } from '../adapters/jobs/InMemoryJobQueue';
import type { Job } from '../adapters/jobs/JobQueue';
import { DEFAULT_JOB_RUNNER_CONFIG, JobRunner } from './JobRunner';

/** Fast config: retries are due almost immediately and the interval is
 *  long enough that tests drive poll cycles manually. */
const testConfig = {
    ...DEFAULT_JOB_RUNNER_CONFIG,
    pollIntervalMs: 60_000,
    retryBaseDelayMs: 1,
    timeoutMs: 40,
};

function createCaptureDestination(): LoggerDestination & {
    lines: string[];
} {
    const lines: string[] = [];
    return {
        out: line => lines.push(line),
        err: line => lines.push(line),
        lines,
    };
}

/** Minimal sleep helper for retry-due waits. */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function makeRunner() {
    const queue = new InMemoryJobQueue(new NativeDateProvider());
    const metrics = new PrometheusMetricsAdapter();
    const dest = createCaptureDestination();
    const logger = new ConsoleLogger(LogLevel.DEBUG, dest);
    const runner = new JobRunner(queue, logger, metrics, testConfig);
    return { queue, metrics, runner, logLines: dest.lines };
}

describe('JobRunner', () => {
    it('executes a due job and records completion metrics', async () => {
        const { queue, metrics, runner } = makeRunner();
        const seen: Job[] = [];
        runner.register('rollover', {
            handle: async job => {
                seen.push(job);
            },
        });
        await queue.schedule('rollover', { date: '2026-09-05' }, new Date(Date.now() - 1000));

        await runner.pollOnce();

        expect(seen.length).toBe(1);
        expect(seen[0]?.payload).toEqual({ date: '2026-09-05' });
        const [job] = await queue.findRecentByType('rollover', 10);
        expect(job?.status).toBe('completed');

        const out = metrics.render();
        expect(out).toContain('erledigen_jobs_total{status="completed",type="rollover"} 1');
        expect(out).toContain('erledigen_job_duration_seconds_count{type="rollover"} 1');
    });

    it('retries a failed job with backoff and completes on the second attempt', async () => {
        const { queue, metrics, runner } = makeRunner();
        let calls = 0;
        runner.register('rollover', {
            handle: async () => {
                calls++;
                if (calls === 1) throw new Error('transient failure');
            },
        });
        await queue.schedule('rollover', {}, new Date(Date.now() - 1000));

        await runner.pollOnce();
        let [job] = await queue.findRecentByType('rollover', 10);
        expect(job?.status).toBe('failed');
        expect(job?.attempts).toBe(1);
        expect(job?.lastError).toBe('transient failure');

        // Retry base delay is 1ms; give it a moment to become due.
        await sleep(10);
        await runner.pollOnce();
        [job] = await queue.findRecentByType('rollover', 10);
        expect(job?.status).toBe('completed');
        expect(job?.attempts).toBe(1);

        const out = metrics.render();
        expect(out).toContain('erledigen_jobs_total{status="failed",type="rollover"} 1');
        expect(out).toContain('erledigen_jobs_total{status="completed",type="rollover"} 1');
    });

    it('marks a job dead after max attempts', async () => {
        const { queue, metrics, runner } = makeRunner();
        runner.register('purge-deleted', {
            handle: async () => {
                throw new Error('always fails');
            },
        });
        await queue.schedule('purge-deleted', {}, new Date(Date.now() - 1000));

        for (let attempt = 0; attempt < 3; attempt++) {
            await runner.pollOnce();
            await sleep(10); // let the backoff-scheduled retry become due
        }

        const [job] = await queue.findRecentByType('purge-deleted', 10);
        expect(job?.status).toBe('dead');
        expect(job?.attempts).toBe(3);
        expect(metrics.render()).toContain(
            'erledigen_jobs_total{status="dead",type="purge-deleted"} 1',
        );
    });

    it('times out a handler that runs too long and treats it as a failure', async () => {
        const { queue, runner } = makeRunner();
        runner.register('slow-job', {
            handle: async () => {
                await sleep(200); // far beyond the 40ms test timeout
            },
        });
        await queue.schedule('slow-job', {}, new Date(Date.now() - 1000));

        await runner.pollOnce();

        const [job] = await queue.findRecentByType('slow-job', 10);
        expect(job?.status).toBe('failed');
        expect(job?.lastError).toBe('Timed out after 40ms');
    });

    it('leaves jobs pending when no handler is registered for the type', async () => {
        const { queue, runner, logLines } = makeRunner();
        await queue.schedule('unregistered-type', {}, new Date(Date.now() - 1000));

        await runner.pollOnce();

        const [job] = await queue.findRecentByType('unregistered-type', 10);
        expect(job?.status).toBe('pending');
        expect(logLines.some(line => line.includes('No handler registered'))).toBe(true);
    });

    it('recovers stuck running jobs on start and runs them', async () => {
        const { queue, runner, logLines } = makeRunner();
        const seen: string[] = [];
        runner.register('rollover', {
            handle: async job => {
                seen.push(job.id);
            },
        });
        // Simulate a crashed process: the job is left in running state.
        const stuck = await queue.schedule('rollover', {}, new Date(Date.now() - 1000));
        await queue.markRunning(stuck.id);

        await runner.start();
        await runner.pollOnce();
        await runner.stop();

        expect(seen).toEqual([stuck.id]);
        const [job] = await queue.findRecentByType('rollover', 10);
        expect(job?.status).toBe('completed');
        expect(logLines.some(line => line.includes('Recovered stuck jobs'))).toBe(true);
    });

    it('drains a job immediately via kick()', async () => {
        const { queue, runner } = makeRunner();
        let handled = false;
        runner.register('rollover', {
            handle: async () => {
                handled = true;
            },
        });
        await queue.schedule('rollover', {}, new Date(Date.now() - 1000));

        runner.kick();
        await sleep(50);

        expect(handled).toBe(true);
    });

    it('keeps the pending/running gauges fresh after each cycle', async () => {
        const { queue, metrics, runner } = makeRunner();
        runner.register('rollover', {
            handle: async () => {},
        });
        await queue.schedule('rollover', {}, new Date(Date.now() - 1000));

        await runner.pollOnce();

        const out = metrics.render();
        expect(out).toContain('erledigen_jobs_running 0');
        // The type was seen while pending; after completion it drains to 0.
        expect(out).toContain('erledigen_jobs_pending{type="rollover"} 0');
    });

    it('stop() awaits a job that is still executing', async () => {
        const queue = new InMemoryJobQueue(new NativeDateProvider());
        const metrics = new PrometheusMetricsAdapter();
        const dest = createCaptureDestination();
        const logger = new ConsoleLogger(LogLevel.DEBUG, dest);
        // No timeout for this test: the runner must await the whole handler,
        // not abandon it to the timeout path (that path is covered above).
        const runner = new JobRunner(queue, logger, metrics, {
            ...testConfig,
            timeoutMs: 60_000,
        });
        let finished = false;
        runner.register('slow-but-ok', {
            handle: async () => {
                await sleep(80);
                finished = true;
            },
        });
        await queue.schedule('slow-but-ok', {}, new Date(Date.now() - 1000));

        const polling = runner.pollOnce();
        await sleep(10); // let the job start executing
        await runner.stop();
        await polling;

        expect(finished).toBe(true);
        const [job] = await queue.findRecentByType('slow-but-ok', 10);
        expect(job?.status).toBe('completed');
    });
});
