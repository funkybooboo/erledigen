/**
 * JobQueue contract tests (see ADR-002)
 *
 * The same suite runs against every JobQueue implementation
 * (InMemoryJobQueue, SqliteJobQueue) to guarantee behavioral parity,
 * mirroring the repository contract suites (see ADR-001).
 */

import { describe, expect, test } from 'bun:test';
import type { Job, JobQueue } from '../JobQueue';

/** A past instant: anything scheduled here is immediately due. */
function aMomentAgo(): Date {
    return new Date(Date.now() - 1000);
}

/** An older past instant: orders before aMomentAgo() in every queue. */
function aMinuteAgo(): Date {
    return new Date(Date.now() - 60_000);
}

/** A future instant: nothing scheduled here is due yet. */
function inAMinute(): Date {
    return new Date(Date.now() + 60_000);
}

export function runJobQueueContractTests(makeQueue: () => JobQueue): void {
    describe('schedule', () => {
        test('queues a pending job with the payload and default max attempts', async () => {
            const queue = makeQueue();
            const job = await queue.schedule('rollover', { date: '2026-09-05' }, aMomentAgo());

            expect(job.id).toBeDefined();
            expect(job.type).toBe('rollover');
            expect(job.payload).toEqual({ date: '2026-09-05' });
            expect(job.status).toBe('pending');
            expect(job.attempts).toBe(0);
            expect(job.maxAttempts).toBe(3);
            expect(job.startedAt).toBeNull();
            expect(job.completedAt).toBeNull();
            expect(job.lastError).toBeNull();
        });

        test('returns due jobs in getPending, oldest scheduled first', async () => {
            const queue = makeQueue();
            const first = await queue.schedule('rollover', {}, aMomentAgo());
            const second = await queue.schedule('purge-deleted', {}, aMomentAgo());

            const pending = await queue.getPending();
            expect(pending.map(job => job.id)).toEqual([first.id, second.id]);
        });

        test('does not return jobs scheduled for the future', async () => {
            const queue = makeQueue();
            await queue.schedule('rollover', {}, inAMinute());

            expect(await queue.getPending()).toEqual([]);
        });
    });

    describe('lifecycle transitions', () => {
        test('markRunning claims the job out of the pending set', async () => {
            const queue = makeQueue();
            const job = await queue.schedule('rollover', {}, aMomentAgo());

            await queue.markRunning(job.id);

            expect(await queue.getPending()).toEqual([]);
        });

        test('markCompleted finishes the job', async () => {
            const queue = makeQueue();
            const job = await queue.schedule('rollover', {}, aMomentAgo());
            await queue.markRunning(job.id);

            await queue.markCompleted(job.id);

            expect(await queue.getPending()).toEqual([]);
        });

        test('markFailed reschedules with attempts and last error', async () => {
            const queue = makeQueue();
            const job = await queue.schedule('rollover', {}, aMomentAgo());
            await queue.markRunning(job.id);

            // Retry in the future: not due yet.
            await queue.markFailed(job.id, 'first failure', inAMinute());
            expect(await queue.getPending()).toEqual([]);

            // Retry due now: back in the pending set as a failed job.
            await queue.markFailed(job.id, 'second failure', aMomentAgo());
            const pending = await queue.getPending();
            const retried = pending.find(candidate => candidate.id === job.id);
            expect(retried).toBeDefined();
            expect(retried?.status).toBe('failed');
            expect(retried?.attempts).toBe(2);
            expect(retried?.lastError).toBe('second failure');
        });

        test('markDead is terminal: never pending again', async () => {
            const queue = makeQueue();
            const job = await queue.schedule('rollover', {}, aMomentAgo());
            await queue.markRunning(job.id);

            await queue.markDead(job.id, 'gave up');

            expect(await queue.getPending()).toEqual([]);
            const stats = await queue.getStats();
            expect(stats.dead).toBe(1);
        });
    });

    describe('cancel', () => {
        test('removes a pending job from the queue', async () => {
            const queue = makeQueue();
            const job = await queue.schedule('rollover', {}, aMomentAgo());

            await queue.cancel(job.id);

            expect(await queue.getPending()).toEqual([]);
            expect(await queue.findRecentByType('rollover', 10)).toEqual([]);
        });

        test('is a no-op for a completed job', async () => {
            const queue = makeQueue();
            const job = await queue.schedule('rollover', {}, aMomentAgo());
            await queue.markRunning(job.id);
            await queue.markCompleted(job.id);

            await queue.cancel(job.id);

            const recent = await queue.findRecentByType('rollover', 10);
            expect(recent.length).toBe(1);
        });
    });

    describe('recoverStuckJobs', () => {
        test('resets running jobs to pending (attempts preserved)', async () => {
            const queue = makeQueue();
            const job = await queue.schedule('rollover', {}, aMomentAgo());
            await queue.markRunning(job.id);
            await queue.markFailed(job.id, 'crashed mid-flight', aMomentAgo());
            await queue.markRunning(job.id);

            const reset = await queue.recoverStuckJobs();

            expect(reset).toBe(1);
            const pending = await queue.getPending();
            expect(pending.length).toBe(1);
            expect(pending[0]?.attempts).toBe(1);
        });

        test('is a no-op when nothing is stuck', async () => {
            const queue = makeQueue();
            await queue.schedule('rollover', {}, aMomentAgo());
            expect(await queue.recoverStuckJobs()).toBe(0);
        });
    });

    describe('getStats', () => {
        test('counts pending, running, and dead jobs with per-type breakdown', async () => {
            const queue = makeQueue();
            await queue.schedule('rollover', {}, aMomentAgo());
            await queue.schedule('rollover', {}, inAMinute());
            await queue.schedule('purge-deleted', {}, aMomentAgo());
            const dead = await queue.schedule('rollover', {}, aMomentAgo());
            await queue.markDead(dead.id, 'gone');

            const stats = await queue.getStats();

            // rollover: one due, one future; purge-deleted: one due; dead: one.
            expect(stats.pending).toBe(3);
            expect(stats.dead).toBe(1);
            expect(stats.running).toBe(0);
            expect(stats.pendingByType['rollover']).toBe(2);
            expect(stats.pendingByType['purge-deleted']).toBe(1);
        });
    });

    describe('findRecentByType', () => {
        test('returns jobs of the type, most recently scheduled first', async () => {
            const queue = makeQueue();
            // Distinct instants: equal scheduledAt values would tie arbitrarily.
            const older = await queue.schedule('rollover', { date: '2026-09-04' }, aMinuteAgo());
            const newer = await queue.schedule('rollover', { date: '2026-09-05' }, aMomentAgo());
            await queue.schedule('purge-deleted', {}, aMomentAgo());

            const recent = await queue.findRecentByType('rollover', 10);

            expect(recent.map((job: Job) => job.id)).toEqual([newer.id, older.id]);
        });

        test('respects the limit', async () => {
            const queue = makeQueue();
            await queue.schedule('rollover', { n: 1 }, aMinuteAgo());
            await queue.schedule('rollover', { n: 2 }, aMomentAgo());

            const recent = await queue.findRecentByType('rollover', 1);

            expect(recent.length).toBe(1);
            expect(recent[0]?.payload).toEqual({ n: 2 });
        });
    });
}
