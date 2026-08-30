import type { TagKind, WsServerMessage } from '@erledigen/shared';
import { getTagsByKind } from '@erledigen/shared';
import { container } from '$lib/container';
import { type TagInfo, TagService } from '$lib/services/tagService';
import { websocketService } from '$lib/services/websocketService';

const tagService = new TagService(container.httpClient);

class TagStore {
    tags = $state<string[]>([]);
    tagInfo = $state<TagInfo[]>([]);
    #messageUnsubscribe: (() => void) | null = null;

    initWebSocket(): void {
        this.#messageUnsubscribe = websocketService.onServerMessage((message: WsServerMessage) => {
            switch (message.type) {
                case 'tag:renamed':
                case 'tag:merged':
                    this.fetchAll();
                    this.fetchInfo();
                    break;
            }
        });
    }

    destroyWebSocket(): void {
        this.#messageUnsubscribe?.();
        this.#messageUnsubscribe = null;
    }

    async fetchAll() {
        try {
            this.tags = await tagService.getAll();
        } catch {
            // Keep empty state
        }
    }

    async fetchInfo() {
        try {
            this.tagInfo = await tagService.getInfo();
        } catch {
            // Keep empty state
        }
    }

    async rename(from: string, to: string) {
        try {
            await tagService.rename(from, to);
            await this.fetchAll();
            return true;
        } catch {
            return false;
        }
    }

    async merge(sources: string[], target: string) {
        try {
            await tagService.merge(sources, target);
            await this.fetchAll();
            return true;
        } catch {
            return false;
        }
    }

    groupedByKind(
        kinds: TagKind[],
        kindMap: Record<string, string>,
    ): Map<TagKind | null, string[]> {
        return getTagsByKind(this.tags, kinds, kindMap);
    }
}

export const tagStore = new TagStore();
