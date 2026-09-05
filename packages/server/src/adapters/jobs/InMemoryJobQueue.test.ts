import { describe } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { runJobQueueContractTests } from './contracts/jobQueueContract';
import { InMemoryJobQueue } from './InMemoryJobQueue';

function makeQueue(): InMemoryJobQueue {
    return new InMemoryJobQueue(new NativeDateProvider());
}

describe('InMemoryJobQueue', () => {
    runJobQueueContractTests(makeQueue);
});
