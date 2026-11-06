import { describe } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runSomedayTabRepositoryContractTests } from './contracts/somedayTabRepositoryContract';
import { InMemorySomedayTabRepository } from './InMemorySomedayTabRepository';

describe('InMemorySomedayTabRepository', () => {
    runSomedayTabRepositoryContractTests(
        () => new InMemorySomedayTabRepository(new NativeDateProvider()),
    );
});
