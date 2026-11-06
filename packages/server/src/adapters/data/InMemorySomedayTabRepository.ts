import type {
    CreateSomedayTabInput,
    DateProvider,
    SomedayTab,
    UpdateSomedayTabInput,
} from '@erledigen/shared';
import { DEFAULT_SOMEDAY_TAB_ID } from '@erledigen/shared';
import type { SomedayTabRepository } from './SomedayTabRepository';

/**
 * In-memory SomedayTab persistence. Seeds the default tab in the
 * constructor so every implementation starts from the same shape as a
 * migrated SQLite database (migration 013) -- the contract suite and
 * in-memory deployments both rely on the default tab existing.
 */
export class InMemorySomedayTabRepository implements SomedayTabRepository {
    private tabs: Map<string, SomedayTab> = new Map();
    private idCounter = 0;

    constructor(private dateProvider: DateProvider) {
        this.tabs.set(DEFAULT_SOMEDAY_TAB_ID, {
            id: DEFAULT_SOMEDAY_TAB_ID,
            name: 'Someday',
            position: 0,
            projectTag: null,
            createdAt: this.dateProvider.timestamp(),
        });
    }

    async findAll(): Promise<SomedayTab[]> {
        return Array.from(this.tabs.values()).sort((a, b) => {
            const posCompare = a.position - b.position;
            if (posCompare !== 0) return posCompare;
            return a.createdAt.localeCompare(b.createdAt);
        });
    }

    async findById(id: string): Promise<SomedayTab | null> {
        return this.tabs.get(id) ?? null;
    }

    async create(input: CreateSomedayTabInput): Promise<SomedayTab> {
        const id = (++this.idCounter).toString();
        const tab: SomedayTab = {
            id,
            name: input.name,
            position: input.position,
            projectTag: input.projectTag ?? null,
            createdAt: this.dateProvider.timestamp(),
        };
        this.tabs.set(id, tab);
        return tab;
    }

    async update(id: string, input: UpdateSomedayTabInput): Promise<SomedayTab | null> {
        const existing = this.tabs.get(id);
        if (!existing) return null;
        const updated: SomedayTab = { ...existing, ...input };
        this.tabs.set(id, updated);
        return updated;
    }

    async replaceAll(tabs: SomedayTab[]): Promise<void> {
        this.tabs.clear();
        for (const tab of tabs) {
            this.tabs.set(tab.id, { ...tab });
        }
        this.idCounter = tabs.reduce(
            (max, tab) => Math.max(max, Number.parseInt(tab.id, 10) || 0),
            0,
        );
    }

    async delete(id: string): Promise<boolean> {
        return this.tabs.delete(id);
    }

    async deleteAll(): Promise<void> {
        this.tabs.clear();
        this.idCounter = 0;
    }
}
