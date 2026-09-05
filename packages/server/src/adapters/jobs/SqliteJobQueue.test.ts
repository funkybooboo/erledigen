import { describe } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { SqliteConnection } from '../data/sqliteConnection';
import { runJobQueueContractTests } from './contracts/jobQueueContract';
import { SqliteJobQueue } from './SqliteJobQueue';

// Fresh :memory: database per test: full isolation, no file cleanup.
function makeQueue(): SqliteJobQueue {
    const connection = new SqliteConnection(':memory:');
    return new SqliteJobQueue(connection.db, new NativeDateProvider());
}

describe('SqliteJobQueue', () => {
    runJobQueueContractTests(makeQueue);
});
