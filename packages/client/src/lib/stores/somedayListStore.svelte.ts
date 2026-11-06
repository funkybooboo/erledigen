import type {
    CreateSomedayListInput,
    SomedayList,
    UpdateSomedayListInput,
    WsServerMessage,
} from '@erledigen/shared';
import { container } from '#lib/container.ts';
import { SomedayListService } from '#lib/services/somedayListService.ts';
import { EntityStore } from './entityStore.svelte';

const somedayListService = new SomedayListService(container.httpClient);

// Reads go through the sortedLists getter (sorted on every read), so the
// base class does not need a sort() override.
class SomedayListStore extends EntityStore<
    SomedayList,
    CreateSomedayListInput,
    UpdateSomedayListInput
> {
    constructor() {
        super(somedayListService);
    }

    get sortedLists(): SomedayList[] {
        return [...this.items].sort((a, b) => a.position - b.position);
    }

    // The server broadcasts every list mutation; without this the
    // Someday panel in another tab keeps stale lists until reload.
    protected override onServerMessage(message: WsServerMessage): void {
        switch (message.type) {
            case 'somedayList:created':
                this.upsert(message.payload.list);
                break;
            case 'somedayList:updated':
                this.items = this.items.map(l =>
                    l.id === message.payload.list.id ? message.payload.list : l,
                );
                break;
            case 'somedayList:deleted':
                this.items = this.items.filter(l => l.id !== message.payload.id);
                break;
        }
    }
}

export const somedayListStore = new SomedayListStore();
