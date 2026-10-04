import { describe } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runDayNoteRepositoryContractTests } from './contracts/dayNoteRepositoryContract';
import { SqliteDayNoteRepository } from './SqliteDayNoteRepository';
import { SqliteConnection } from './sqliteConnection';

// Fresh :memory: database per test -- full isolation, no file cleanup needed.
function makeRepo() {
    const connection = new SqliteConnection(':memory:');
    return new SqliteDayNoteRepository(connection.db, new NativeDateProvider());
}

describe('SqliteDayNoteRepository', () => {
    runDayNoteRepositoryContractTests(makeRepo);
});
