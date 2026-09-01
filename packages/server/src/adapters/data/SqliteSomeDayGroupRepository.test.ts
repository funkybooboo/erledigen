import { describe } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runSomeDayGroupRepositoryContractTests } from './contracts/someDayGroupRepositoryContract';
import { SqliteSomeDayGroupRepository } from './SqliteSomeDayGroupRepository';
import { SqliteConnection } from './sqliteConnection';

// Fresh :memory: database per test — full isolation, no file cleanup needed.
function makeRepo() {
    const connection = new SqliteConnection(':memory:');
    return new SqliteSomeDayGroupRepository(connection.db, new NativeDateProvider());
}

describe('SqliteSomeDayGroupRepository', () => {
    runSomeDayGroupRepositoryContractTests(makeRepo);
});
