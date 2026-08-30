import type {
    CreateRecurringTaskInput,
    RecurringTask,
    UpdateRecurringTaskInput,
} from '@erledigen/shared';
import { container } from '$lib/container';
import { RecurringTaskService } from '$lib/services/recurringTaskService';
import { EntityStore } from './entityStore.svelte';

const recurringTaskService = new RecurringTaskService(container.httpClient);

class RecurringTaskStore extends EntityStore<
    RecurringTask,
    CreateRecurringTaskInput,
    UpdateRecurringTaskInput
> {
    constructor() {
        super(recurringTaskService);
    }

    get tasks(): RecurringTask[] {
        return this.items;
    }
}

export const recurringTaskStore = new RecurringTaskStore();
