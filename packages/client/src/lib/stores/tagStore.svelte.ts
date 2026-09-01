import type { TagKind, WsServerMessage } from '@erledigen/shared';
import { getTagsByKind } from '@erledigen/shared';
import { container } from '$lib/container';
import { type TagInfo, TagService } from '$lib/services/tagService';
import { websocketService } from '$lib/services/websocketService';

const tagService = new TagService(container.httpClient);

class TagStore {
    tags = $state<string[]>([]);
    #logger = container.logger;
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
        } catch (error) {
            this.#logger.warn('Failed to fetch tags', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    async fetchInfo() {
        try {
            this.tagInfo = await tagService.getInfo();
        } catch (error) {
            this.#logger.warn('Failed to fetch tag info', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    async rename(from: string, to: string) {
        try {
            await tagService.rename(from, to);
            await this.fetchAll();
            return true;
        } catch (error) {
            this.#logger.warn('Failed to rename tag', {
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }

    async merge(sources: string[], target: string) {
        try {
            await tagService.merge(sources, target);
            await this.fetchAll();
            return true;
        } catch (error) {
            this.#logger.warn('Failed to merge tags', {
                error: error instanceof Error ? error.message : String(error),
            });
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
