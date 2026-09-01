import { describe, expect, test } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runRecurringTaskRepositoryContractTests } from './contracts/recurringTaskRepositoryContract';
import { InMemoryRecurringTaskRepository } from './InMemoryRecurringTaskRepository';

function makeRepo() {
    return new InMemoryRecurringTaskRepository(new NativeDateProvider());
}

describe('InMemoryRecurringTaskRepository', () => {
    runRecurringTaskRepositoryContractTests(makeRepo);

    // Implementation-specific: deleteAll is a test utility not part of the
    // RecurringTaskRepository contract.
    describe('deleteAll', () => {
        test('clears both tasks and stats', async () => {
            const repo = makeRepo();
            const task = await repo.create({
                text: 'A',
                frequency: 'daily',
                startDate: '2026-04-01',
            });
            await repo.upsertStats({
                recurringTaskId: task.id,
                currentStreak: 1,
                longestStreak: 1,
                totalCompletions: 1,
                lastCompletedDate: null,
            });
            await repo.deleteAll();
            expect(await repo.findAll()).toEqual([]);
            expect(await repo.findStats(task.id)).toBeNull();
        });
    });
});
