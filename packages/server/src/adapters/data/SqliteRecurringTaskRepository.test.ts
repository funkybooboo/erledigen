import { describe } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runRecurringTaskRepositoryContractTests } from './contracts/recurringTaskRepositoryContract';
import { SqliteRecurringTaskRepository } from './SqliteRecurringTaskRepository';
import { SqliteConnection } from './sqliteConnection';

// Fresh :memory: database per test — full isolation, no file cleanup needed.
function makeRepo() {
    const connection = new SqliteConnection(':memory:');
    return new SqliteRecurringTaskRepository(connection.db, new NativeDateProvider());
}

describe('SqliteRecurringTaskRepository', () => {
    runRecurringTaskRepositoryContractTests(makeRepo);
});
