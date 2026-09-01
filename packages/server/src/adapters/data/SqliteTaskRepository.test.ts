import { describe } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runTaskRepositoryContractTests } from './contracts/taskRepositoryContract';
import { SqliteTaskRepository } from './SqliteTaskRepository';
import { SqliteConnection } from './sqliteConnection';

// Fresh :memory: database per test — full isolation, no file cleanup needed.
function makeRepo() {
    const connection = new SqliteConnection(':memory:');
    return new SqliteTaskRepository(connection.db, new NativeDateProvider());
}

describe('SqliteTaskRepository', () => {
    runTaskRepositoryContractTests(makeRepo);
});
