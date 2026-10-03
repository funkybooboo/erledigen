import type {
    CreateSomeDayGroupInput,
    SomeDayGroup,
    UpdateSomeDayGroupInput,
    WsServerMessage,
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

    // The server broadcasts every group mutation; without this the
    // Someday panel in another tab keeps stale groups until reload.
    protected override onServerMessage(message: WsServerMessage): void {
        switch (message.type) {
            case 'someDayGroup:created':
                this.upsert(message.payload.group);
                break;
            case 'someDayGroup:updated':
                this.items = this.items.map(g =>
                    g.id === message.payload.group.id ? message.payload.group : g,
                );
                break;
            case 'someDayGroup:deleted':
                this.items = this.items.filter(g => g.id !== message.payload.id);
                break;
        }
    }
}

export const someDayGroupStore = new SomeDayGroupStore();
