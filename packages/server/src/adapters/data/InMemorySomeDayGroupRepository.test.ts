import { describe, expect, test } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runSomeDayGroupRepositoryContractTests } from './contracts/someDayGroupRepositoryContract';
import { InMemorySomeDayGroupRepository } from './InMemorySomeDayGroupRepository';

function makeRepo() {
    return new InMemorySomeDayGroupRepository(new NativeDateProvider());
}

describe('InMemorySomeDayGroupRepository', () => {
    runSomeDayGroupRepositoryContractTests(makeRepo);

    // Implementation-specific: deleteAll is a test utility not part of the
    // SomeDayGroupRepository contract.
    describe('deleteAll', () => {
        test('empties the store', async () => {
            const repo = makeRepo();
            await repo.create({ name: 'A', tag: '#a', position: 0 });
            await repo.create({ name: 'B', tag: '#b', position: 1 });
            await repo.deleteAll();
            expect(await repo.findAll()).toEqual([]);
        });
    });
});
