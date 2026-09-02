import { describe } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runProjectRepositoryContractTests } from './contracts/projectRepositoryContract';
import { SqliteProjectRepository } from './SqliteProjectRepository';
import { SqliteConnection } from './sqliteConnection';

// Fresh :memory: database per test -- full isolation, no file cleanup needed.
function makeRepo() {
    const connection = new SqliteConnection(':memory:');
    return new SqliteProjectRepository(connection.db, new NativeDateProvider());
}

describe('SqliteProjectRepository', () => {
    runProjectRepositoryContractTests(makeRepo);
});
