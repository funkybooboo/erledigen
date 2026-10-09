import type { TagKind } from '@erledigen/shared';
import { getTagsByKind, leastUsedTagColor, PRIORITY_TAGS } from '@erledigen/shared';
import { container } from '$lib/container';
import { type TagInfo, TagService } from '$lib/services/tagService';
import { preferencesStore } from './preferencesStore.svelte';
import { subscribeServerMessages } from './wsSync';

const tagService = new TagService(container.httpClient);

class TagStore {
    tags = $state<string[]>([]);
    #logger = container.logger;
    tagInfo = $state<TagInfo[]>([]);
    #messageUnsubscribe: (() => void) | null = null;

    initWebSocket(): void {
        this.#messageUnsubscribe = subscribeServerMessages(
            () => {
                // Tags are derived from tasks, so a restore means both
                // tag views refetch.
                this.fetchAll();
                this.fetchInfo();
            },
            message => {
                switch (message.type) {
                    case 'tag:renamed':
                    case 'tag:merged':
                    case 'tag:deleted':
                        this.fetchAll();
                        this.fetchInfo();
                        break;
                }
            },
        );
    }

    destroyWebSocket(): void {
        this.#messageUnsubscribe?.();
        this.#messageUnsubscribe = null;
    }

    async fetchAll() {
        try {
            this.tags = await tagService.getAll();
            this.autoAssignColors();
        } catch (error) {
            this.#logger.warn('Failed to fetch tags', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /** USE-4: every tag gets a distinct pastel color. Tags without an
     *  explicit entry in preferencesStore.tagColors (auto-assignments
     *  persist there too) get the palette color used by the fewest tags.
     *  Priority tags keep their semantic pill colors, so they never
     *  enter the assignment map. Skipped until the preferences have
     *  loaded -- otherwise the startup race would re-assign from the
     *  defaults and clobber the saved map. */
    autoAssignColors() {
        if (!preferencesStore.loaded) return;
        const colors = { ...preferencesStore.tagColors };
        let changed = false;
        for (const tag of this.tags) {
            if (colors[tag] !== undefined) continue;
            if (PRIORITY_TAGS.includes(tag as (typeof PRIORITY_TAGS)[number])) continue;
            colors[tag] = leastUsedTagColor(colors);
            changed = true;
        }
        if (changed) preferencesStore.setTagColors(colors);
    }

    /** Move a tag's color entry along with a rename (USE-5 management;
     *  the server renames tags across tasks, the color map is ours to
     *  keep in step). Runs after the server confirmed. */
    private rekeyTagColor(from: string, to: string) {
        const colors = preferencesStore.tagColors;
        if (colors[from] === undefined) return;
        const next = { ...colors };
        next[to] = colors[from];
        delete next[from];
        preferencesStore.setTagColors(next);
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
            this.rekeyTagColor(from, to);
            await this.fetchAll();
            await this.fetchInfo();
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
            // Sources die: drop their color entries; the target keeps its
            // own (or gets nothing -- no color is a valid state).
            const colors = preferencesStore.tagColors;
            const dropped = sources.some(source => colors[source] !== undefined);
            if (dropped) {
                const next = { ...colors };
                for (const source of sources) delete next[source];
                preferencesStore.setTagColors(next);
            }
            await this.fetchAll();
            await this.fetchInfo();
            return true;
        } catch (error) {
            this.#logger.warn('Failed to merge tags', {
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }

    async delete(name: string) {
        try {
            await tagService.delete(name);
            // The tag is gone; its color assignment goes with it.
            const colors = preferencesStore.tagColors;
            if (colors[name] !== undefined) {
                const next = { ...colors };
                delete next[name];
                preferencesStore.setTagColors(next);
            }
            await this.fetchAll();
            await this.fetchInfo();
            return true;
        } catch (error) {
            this.#logger.warn('Failed to delete tag', {
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
