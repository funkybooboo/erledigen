import type {
    CreateSomeDayGroupInput,
    SomeDayGroup,
    UpdateSomeDayGroupInput,
    WsServerMessage,
} from '@erledigen/shared';
import { container } from '$lib/container';
import { SomeDayGroupService } from '$lib/services/someDayGroupService';
import { websocketService } from '$lib/services/websocketService';
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
    #messageUnsubscribe: (() => void) | null = null;

    constructor() {
        super(someDayGroupService);
    }

    get sortedGroups(): SomeDayGroup[] {
        return [...this.items].sort((a, b) => a.position - b.position);
    }

    initWebSocket(): void {
        // The server broadcasts every group mutation; without this the
        // Someday panel in another tab keeps stale groups until reload.
        this.#messageUnsubscribe = websocketService.onServerMessage((message: WsServerMessage) => {
            switch (message.type) {
                case 'data:restored':
                    // A JSON restore replaced every table (ADR-009):
                    // refetch the whole list; per-row events cannot
                    // describe a wholesale replace.
                    this.fetchAll();
                    break;

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
        });
    }

    destroyWebSocket(): void {
        this.#messageUnsubscribe?.();
        this.#messageUnsubscribe = null;
    }
}

export const someDayGroupStore = new SomeDayGroupStore();
