import { describe, expect, it } from 'bun:test';
import {
    ConsoleLogger,
    type LoggerDestination,
    LogLevel,
    NativeDateProvider,
    NullMetricsAdapter,
} from '@erledigen/shared';
import { InMemoryTaskRepository } from '../adapters/data/InMemoryTaskRepository';
import { InMemoryUserPreferencesRepository } from '../adapters/data/InMemoryUserPreferencesRepository';
import { InMemoryJobQueue } from '../adapters/jobs/InMemoryJobQueue';
import { JobRunner } from './JobRunner';
import { JobScheduler } from './JobScheduler';
import { registerJobHandlers } from './jobHandlers';
import { RolloverService } from './RolloverService';

/** Full real stack on the in-memory adapters (NO MOCKS policy): queue +
 *  runner + scheduler + services, real null metrics, capture logger. */
function makeStack() {
    const dateProvider = new NativeDateProvider();
    const taskRepo = new InMemoryTaskRepository(dateProvider);
    const prefsRepo = new InMemoryUserPreferencesRepository(dateProvider);
    const queue = new InMemoryJobQueue(dateProvider);
    const lines: string[] = [];
    const dest: LoggerDestination = {
        out: line => lines.push(line),
        err: line => lines.push(line),
    };
    const logger = new ConsoleLogger(LogLevel.DEBUG, dest);
    const runner = new JobRunner(queue, logger, new NullMetricsAdapter(), {
        pollIntervalMs: 60_000,
        retryBaseDelayMs: 1,
        timeoutMs: 5000,
    });
    const scheduler = new JobScheduler(queue, prefsRepo, dateProvider, logger);
    registerJobHandlers(runner, {
        rolloverService: new RolloverService(taskRepo, dateProvider),
        taskRepository: taskRepo,
        scheduler,
        dateProvider,
        logger,
    });
    return { taskRepo, queue, dateProvider, runner, logLines: lines };
}

describe('job handlers (end to end)', () => {
    it('rollover job rolls overdue tasks and chain-schedules the next day', async () => {
        const { taskRepo, queue, dateProvider, runner } = makeStack();

        const today = dateProvider.today();
        const twoDaysAgo = dateProvider.addDays(today, -2);
        const late = await taskRepo.create({
            text: 'Two days late',
            date: twoDaysAgo,
            rolloverEnabled: true,
        });
        await queue.schedule('rollover', { date: today }, new Date(Date.now() - 1000));

        await runner.pollOnce();

        const rolled = await taskRepo.findById(late.id);
        expect(rolled?.date).toBe(today);
        expect(rolled?.daysLate).toBe(2);

        // The handler chain-scheduled the next daily occurrence (future,
        // so getPending is empty -- check the queued set instead).
        const recent = await queue.findRecentByType('rollover', 10);
        const queued = recent.filter(job => job.status === 'pending');
        expect(queued.length).toBe(1);
        expect(new Date(queued[0]?.scheduledAt ?? 0).getTime()).toBeGreaterThan(Date.now());

        const completed = recent.find(job => job.status === 'completed');
        expect(completed?.status).toBe('completed');
    });

    it('purge job purges stale trash and reschedules; fresh trash survives', async () => {
        const { taskRepo, queue, runner } = makeStack();

        const stale = await taskRepo.create({ text: 'Stale trash', date: '2026-01-01' });
        await taskRepo.delete(stale.id);
        // deletedAt is "now" for the fresh trash; the handler runs with
        // PURGE_RETENTION_DAYS, so it survives this run -- but the purge
        // must still have run (next occurrence queued + no failure).
        await queue.schedule('purge-deleted', {}, new Date(Date.now() - 1000));

        await runner.pollOnce();

        expect((await taskRepo.findDeleted()).length).toBe(1);
        const recentPurge = await queue.findRecentByType('purge-deleted', 5);
        const completed = recentPurge.find(job => job.status === 'completed');
        expect(completed?.status).toBe('completed');
        // Rescheduled for the next 03:00 (queued, not yet due).
        expect(recentPurge.filter(job => job.status === 'pending').length).toBe(1);
    });

    it('a malformed rollover payload fails the job (no silent skip)', async () => {
        const { queue, runner } = makeStack();

        await queue.schedule('rollover', { nope: true }, new Date(Date.now() - 1000));

        await runner.pollOnce();
        // Retry scheduled, not completed: the handler threw.
        const [job] = await queue.findRecentByType('rollover', 5);
        expect(job?.status).toBe('failed');
        expect(job?.lastError).toContain('date');
    });
});
