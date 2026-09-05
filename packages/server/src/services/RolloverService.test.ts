import { describe, expect, it } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { InMemoryTaskRepository } from '../adapters/data/InMemoryTaskRepository';
import { RolloverService } from './RolloverService';

function makeService() {
    const repo = new InMemoryTaskRepository(new NativeDateProvider());
    return { repo, service: new RolloverService(repo, new NativeDateProvider()) };
}

describe('RolloverService', () => {
    it('moves overdue incomplete tasks to the target date', async () => {
        const { repo, service } = makeService();
        const late = await repo.create({ text: 'Late', date: '2026-09-03', rolloverEnabled: true });

        const result = await service.rollover('2026-09-05');

        expect(result.rolledCount).toBe(1);
        const rolled = await repo.findById(late.id);
        expect(rolled?.date).toBe('2026-09-05');
        expect(rolled?.originalScheduledDate).toBe('2026-09-03');
        expect(rolled?.daysLate).toBe(2);
        expect(rolled?.completed).toBe(false);
    });

    it('is idempotent: a second run for the same date finds nothing', async () => {
        const { repo, service } = makeService();
        await repo.create({ text: 'Late', date: '2026-09-03', rolloverEnabled: true });

        await service.rollover('2026-09-05');
        const second = await service.rollover('2026-09-05');

        expect(second.rolledCount).toBe(0);
    });

    it('preserves the first original date across repeat rollovers', async () => {
        const { repo, service } = makeService();
        const task = await repo.create({
            text: 'Serially late',
            date: '2026-09-01',
            rolloverEnabled: true,
        });

        await service.rollover('2026-09-03');
        const result = await service.rollover('2026-09-06');

        expect(result.rolledCount).toBe(1);
        const rolled = await repo.findById(task.id);
        expect(rolled?.date).toBe('2026-09-06');
        // Still counting from the FIRST planned date.
        expect(rolled?.originalScheduledDate).toBe('2026-09-01');
        expect(rolled?.daysLate).toBe(5);
    });

    it('does not roll tasks that already ran today (completed or future)', async () => {
        const { repo, service } = makeService();
        await repo.create({ text: 'Future', date: '2026-09-07', rolloverEnabled: true });
        const done = await repo.create({ text: 'Done', date: '2026-09-03', rolloverEnabled: true });
        await repo.update(done.id, { completed: true });

        const result = await service.rollover('2026-09-05');

        expect(result.rolledCount).toBe(0);
    });

    it('skips recurring instances even when overdue', async () => {
        const { repo, service } = makeService();
        await repo.create({
            text: 'Missed habit',
            date: '2026-09-03',
            rolloverEnabled: true,
            recurringTaskId: 'rt_1',
            instanceDate: '2026-09-03',
        });

        const result = await service.rollover('2026-09-05');

        expect(result.rolledCount).toBe(0);
    });

    it('respects the per-task rolloverEnabled override', async () => {
        const { repo, service } = makeService();
        const optingOut = await repo.create({
            text: 'Stays put',
            date: '2026-09-03',
            rolloverEnabled: false,
        });

        const result = await service.rollover('2026-09-05');

        expect(result.rolledCount).toBe(0);
        expect((await repo.findById(optingOut.id))?.date).toBe('2026-09-03');
    });
});
