import { describe } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runHolidayRepositoryContractTests } from './contracts/holidayRepositoryContract';
import { SqliteHolidayRepository } from './SqliteHolidayRepository';
import { SqliteConnection } from './sqliteConnection';

// Fresh :memory: database per test -- full isolation, no file cleanup needed.
function makeRepo() {
    const connection = new SqliteConnection(':memory:');
    return new SqliteHolidayRepository(connection.db, new NativeDateProvider());
}

describe('SqliteHolidayRepository', () => {
    runHolidayRepositoryContractTests(makeRepo);
});
