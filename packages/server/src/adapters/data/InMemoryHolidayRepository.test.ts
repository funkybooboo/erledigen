import { describe } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runHolidayRepositoryContractTests } from './contracts/holidayRepositoryContract';
import { InMemoryHolidayRepository } from './InMemoryHolidayRepository';

function makeRepo() {
    return new InMemoryHolidayRepository(new NativeDateProvider());
}

describe('InMemoryHolidayRepository', () => {
    runHolidayRepositoryContractTests(makeRepo);
});
