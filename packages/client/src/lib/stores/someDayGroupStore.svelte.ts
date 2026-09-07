import type {
    CreateSomeDayGroupInput,
    SomeDayGroup,
    UpdateSomeDayGroupInput,
} from '@erledigen/shared';
import { container } from '$lib/container';
import { SomeDayGroupService } from '$lib/services/someDayGroupService';
import { EntityStore } from './entityStore.svelte';

const someDayGroupService = new SomeDayGroupService(container.httpClient);

// Reads go through the sortedGroups getter (sorted on every read), so the
// base class does not need a sort() override -- and one that sorted only
// on fetchAll/create (not update) would let a reordering update drift.
class SomeDayGroupStore extends EntityStore<
    SomeDayGroup,
    CreateSomeDayGroupInput,
    UpdateSomeDayGroupInput
> {
    constructor() {
        super(someDayGroupService);
    }

    get sortedGroups(): SomeDayGroup[] {
        return [...this.items].sort((a, b) => a.position - b.position);
    }
}

export const someDayGroupStore = new SomeDayGroupStore();
