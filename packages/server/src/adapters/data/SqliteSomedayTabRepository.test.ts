import { describe } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runSomedayTabRepositoryContractTests } from './contracts/somedayTabRepositoryContract';
import { SqliteSomedayTabRepository } from './SqliteSomedayTabRepository';
import { SqliteConnection } from './sqliteConnection';

// Fresh :memory: database per test -- full isolation, no file cleanup needed.
function makeRepo() {
    const connection = new SqliteConnection(':memory:');
    return new SqliteSomedayTabRepository(connection.db, new NativeDateProvider());
}

describe('SqliteSomedayTabRepository', () => {
    runSomedayTabRepositoryContractTests(makeRepo);
});
