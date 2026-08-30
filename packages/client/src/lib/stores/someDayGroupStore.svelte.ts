import type {
    CreateSomeDayGroupInput,
    SomeDayGroup,
    UpdateSomeDayGroupInput,
} from '@erledigen/shared';
import { container } from '$lib/container';
import { SomeDayGroupService } from '$lib/services/someDayGroupService';
import { EntityStore } from './entityStore.svelte';

const someDayGroupService = new SomeDayGroupService(container.httpClient);

class SomeDayGroupStore extends EntityStore<
    SomeDayGroup,
    CreateSomeDayGroupInput,
    UpdateSomeDayGroupInput
> {
    constructor() {
        super(someDayGroupService);
    }

    get groups(): SomeDayGroup[] {
        return this.items;
    }

    get sortedGroups(): SomeDayGroup[] {
        return [...this.items].sort((a, b) => a.position - b.position);
    }

    protected sort(items: SomeDayGroup[]): SomeDayGroup[] {
        return items.sort((a, b) => a.position - b.position);
    }
}

export const someDayGroupStore = new SomeDayGroupStore();
