import type {
    CreateSomedayTabInput,
    SomedayTab,
    UpdateSomedayTabInput,
    WsServerMessage,
} from '@erledigen/shared';
import { container } from '#lib/container.ts';
import { SomedayTabService } from '#lib/services/somedayTabService.ts';
import { EntityStore } from './entityStore.svelte';

const somedayTabService = new SomedayTabService(container.httpClient);

// Reads go through the sortedTabs getter (sorted on every read), so the
// base class does not need a sort() override -- and one that sorted only
// on fetchAll/create (not update) would let a reordering update drift.
class SomedayTabStore extends EntityStore<
    SomedayTab,
    CreateSomedayTabInput,
    UpdateSomedayTabInput
> {
    constructor() {
        super(somedayTabService);
    }

    get sortedTabs(): SomedayTab[] {
        return [...this.items].sort((a, b) => a.position - b.position);
    }

    // The server broadcasts every tab mutation; without this the
    // Someday panel in another tab keeps stale tabs until reload.
    protected override onServerMessage(message: WsServerMessage): void {
        switch (message.type) {
            case 'somedayTab:created':
                this.upsert(message.payload.tab);
                break;
            case 'somedayTab:updated':
                this.items = this.items.map(t =>
                    t.id === message.payload.tab.id ? message.payload.tab : t,
                );
                break;
            case 'somedayTab:deleted':
                this.items = this.items.filter(t => t.id !== message.payload.id);
                break;
        }
    }
}

export const somedayTabStore = new SomedayTabStore();
