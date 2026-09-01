import { describe } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runUserPreferencesRepositoryContractTests } from './contracts/userPreferencesRepositoryContract';
import { InMemoryUserPreferencesRepository } from './InMemoryUserPreferencesRepository';

function makeRepo() {
    return new InMemoryUserPreferencesRepository(new NativeDateProvider());
}

describe('InMemoryUserPreferencesRepository', () => {
    runUserPreferencesRepositoryContractTests(makeRepo);
});
