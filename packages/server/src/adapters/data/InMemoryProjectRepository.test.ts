import { describe, expect, test } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runProjectRepositoryContractTests } from './contracts/projectRepositoryContract';
import { InMemoryProjectRepository } from './InMemoryProjectRepository';

function makeRepo() {
    return new InMemoryProjectRepository(new NativeDateProvider());
}

describe('InMemoryProjectRepository', () => {
    runProjectRepositoryContractTests(makeRepo);

    // Implementation-specific: deleteAll is a test utility not part of the
    // ProjectRepository contract.
    describe('deleteAll', () => {
        test('empties the store', async () => {
            const repo = makeRepo();
            await repo.create({ name: 'A' });
            await repo.create({ name: 'B' });
            await repo.deleteAll();
            expect(await repo.findAll()).toEqual([]);
        });
    });
});
