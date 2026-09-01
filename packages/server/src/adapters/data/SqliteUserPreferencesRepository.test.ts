import { describe } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runUserPreferencesRepositoryContractTests } from './contracts/userPreferencesRepositoryContract';
import { SqliteUserPreferencesRepository } from './SqliteUserPreferencesRepository';
import { SqliteConnection } from './sqliteConnection';

// Fresh :memory: database per test — full isolation, no file cleanup needed.
function makeRepo() {
    const connection = new SqliteConnection(':memory:');
    return new SqliteUserPreferencesRepository(connection.db, new NativeDateProvider());
}

describe('SqliteUserPreferencesRepository', () => {
    runUserPreferencesRepositoryContractTests(makeRepo);
});
