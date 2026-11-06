import { describe } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runSomedayListRepositoryContractTests } from './contracts/somedayListRepositoryContract';
import { SqliteSomedayListRepository } from './SqliteSomedayListRepository';
import { SqliteConnection } from './sqliteConnection';

// Fresh :memory: database per test -- full isolation, no file cleanup needed.
function makeRepo() {
    const connection = new SqliteConnection(':memory:');
    return new SqliteSomedayListRepository(connection.db, new NativeDateProvider());
}

describe('SqliteSomedayListRepository', () => {
    runSomedayListRepositoryContractTests(makeRepo);
});
