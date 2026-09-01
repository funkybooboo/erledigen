import { describe, expect, test } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runTaskRepositoryContractTests } from './contracts/taskRepositoryContract';
import { InMemoryTaskRepository } from './InMemoryTaskRepository';

function makeRepo() {
    return new InMemoryTaskRepository(new NativeDateProvider());
}

describe('InMemoryTaskRepository', () => {
    runTaskRepositoryContractTests(makeRepo);

    // Implementation-specific: deleteAll is a test utility not part of the
    // TaskRepository contract.
    describe('deleteAll', () => {
        test('empties the store', async () => {
            const repo = makeRepo();
            await repo.create({ text: 'A', date: '2026-04-06' });
            await repo.create({ text: 'B', date: '2026-04-07' });
            await repo.deleteAll();
            expect(await repo.findAll()).toEqual([]);
        });
    });
});
