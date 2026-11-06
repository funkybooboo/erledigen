import { describe } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runSomedayListRepositoryContractTests } from './contracts/somedayListRepositoryContract';
import { InMemorySomedayListRepository } from './InMemorySomedayListRepository';

describe('InMemorySomedayListRepository', () => {
    runSomedayListRepositoryContractTests(
        () => new InMemorySomedayListRepository(new NativeDateProvider()),
    );
});
