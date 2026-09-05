import { describe, expect, it } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { InMemoryUserPreferencesRepository } from '../adapters/data/InMemoryUserPreferencesRepository';
import { InMemoryJobQueue } from '../adapters/jobs/InMemoryJobQueue';
import type { Job } from '../adapters/jobs/JobQueue';
import { JobScheduler } from './JobScheduler';

function makeScheduler() {
    const queue = new InMemoryJobQueue(new NativeDateProvider());
    const prefs = new InMemoryUserPreferencesRepository(new NativeDateProvider());
    const dateProvider = new NativeDateProvider();
    const lines: string[] = [];
    const logger = {
        debug: (m: string) => lines.push(m),
        info: (m: string) => lines.push(m),
        warn: (m: string) => lines.push(m),
        error: (m: string) => lines.push(m),
    };
    const scheduler = new JobScheduler(queue, prefs, dateProvider, logger);
    return { queue, prefs, dateProvider, scheduler, logLines: lines };
}

/** All queued (not yet due) jobs of a type. getPending() only returns jobs
 *  due NOW; future-scheduled recurring jobs are found here instead. */
async function queuedOfType(queue: InMemoryJobQueue, type: string): Promise<Job[]> {
    const recent = await queue.findRecentByType(type, 50);
    return recent.filter(job => job.status === 'pending' || job.status === 'failed');
}

/** The target date carried by a rollover job payload, narrowed without a
 *  type assertion (Biome flags suspicious `as` casts from unknown). */
function rolloverDateOf(job: Job | undefined): string | undefined {
    const payload = job?.payload;
    if (typeof payload !== 'object' || payload === null || !('date' in payload)) return undefined;
    return typeof payload.date === 'string' ? payload.date : undefined;
}

describe('JobScheduler', () => {
    it('catches up immediately when the daily run was missed', async () => {
        const { queue, prefs, scheduler } = makeScheduler();
        expect((await prefs.get()).rolloverEnabled).toBe(true);

        await scheduler.ensureRolloverScheduled();

        const pending = await queue.getPending();
        expect(pending.length).toBe(1);
        expect(pending[0]?.type).toBe('rollover');
        expect(rolloverDateOf(pending[0])).toBe(new NativeDateProvider().today());
    });

    it('does not double-schedule when today already ran', async () => {
        const { queue, scheduler, dateProvider } = makeScheduler();
        const today = dateProvider.today();
        const ran = await queue.schedule('rollover', { date: today }, new Date(Date.now() - 1000));
        await queue.markRunning(ran.id);
        await queue.markCompleted(ran.id);

        await scheduler.ensureRolloverScheduled();

        // Exactly the NEXT daily occurrence is queued, scheduled in the
        // future (getPending stays empty: nothing is due right now).
        const queued = await queuedOfType(queue, 'rollover');
        expect(queued.length).toBe(1);
        expect(new Date(queued[0]?.scheduledAt ?? 0).getTime()).toBeGreaterThan(Date.now());
    });

    it('removes queued rollovers when the user disables auto-rollover', async () => {
        const { queue, prefs, scheduler } = makeScheduler();
        await scheduler.ensureRolloverScheduled(); // queues the catch-up
        await prefs.update({ rolloverEnabled: false });

        await scheduler.ensureRolloverScheduled();

        expect(await queue.getPending()).toEqual([]);
        expect(await queue.findRecentByType('rollover', 10)).toEqual([]);
    });

    it('schedules no future daily run in manual mode', async () => {
        const { queue, prefs, scheduler } = makeScheduler();
        // Simulate "today already ran" so only the daily decision remains.
        await scheduler.ensureRolloverScheduled();
        const catchUp = (await queue.getPending())[0];
        if (catchUp === undefined) throw new Error('catch-up job missing');
        await queue.markRunning(catchUp.id);
        await queue.markCompleted(catchUp.id);

        await prefs.update({ rolloverTriggerTime: 'manual' });
        await scheduler.ensureRolloverScheduled();

        expect(await queue.getPending()).toEqual([]);
    });

    it('queues a nightly purge job for the future', async () => {
        const { queue, scheduler } = makeScheduler();

        await scheduler.ensurePurgeScheduled();

        const queued = await queuedOfType(queue, 'purge-deleted');
        expect(queued.length).toBe(1);
        expect(new Date(queued[0]?.scheduledAt ?? 0).getTime()).toBeGreaterThan(Date.now());
        // 03:00 server time.
        expect(new Date(queued[0]?.scheduledAt ?? 0).getHours()).toBe(3);
    });

    it('does not stack a second purge when one is already queued', async () => {
        const { queue, scheduler } = makeScheduler();
        await scheduler.ensurePurgeScheduled();

        await scheduler.ensurePurgeScheduled();

        const queued = await queuedOfType(queue, 'purge-deleted');
        expect(queued.length).toBe(1);
    });
});
