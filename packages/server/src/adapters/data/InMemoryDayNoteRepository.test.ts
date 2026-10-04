import { describe } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runDayNoteRepositoryContractTests } from './contracts/dayNoteRepositoryContract';
import { InMemoryDayNoteRepository } from './InMemoryDayNoteRepository';

function makeRepo() {
    return new InMemoryDayNoteRepository(new NativeDateProvider());
}

describe('InMemoryDayNoteRepository', () => {
    runDayNoteRepositoryContractTests(makeRepo);
});
