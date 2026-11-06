import type {
    CreateSomedayListInput,
    DateProvider,
    SomedayList,
    UpdateSomedayListInput,
} from '@erledigen/shared';
import { DEFAULT_SOMEDAY_LIST_ID, DEFAULT_SOMEDAY_TAB_ID } from '@erledigen/shared';
import type { SomedayListRepository } from './SomedayListRepository';

/**
 * In-memory SomedayList persistence. Seeds the default list in the
 * constructor so every implementation starts from the same shape as a
 * migrated SQLite database (migration 013).
 */
export class InMemorySomedayListRepository implements SomedayListRepository {
    private lists: Map<string, SomedayList> = new Map();
    private idCounter = 0;

    constructor(private dateProvider: DateProvider) {
        this.lists.set(DEFAULT_SOMEDAY_LIST_ID, {
            id: DEFAULT_SOMEDAY_LIST_ID,
            tabId: DEFAULT_SOMEDAY_TAB_ID,
            name: 'Someday',
            position: 0,
            createdAt: this.dateProvider.timestamp(),
        });
    }

    async findAll(): Promise<SomedayList[]> {
        return Array.from(this.lists.values()).sort((a, b) => {
            const posCompare = a.position - b.position;
            if (posCompare !== 0) return posCompare;
            return a.createdAt.localeCompare(b.createdAt);
        });
    }

    async findById(id: string): Promise<SomedayList | null> {
        return this.lists.get(id) ?? null;
    }

    async create(input: CreateSomedayListInput): Promise<SomedayList> {
        const id = (++this.idCounter).toString();
        const list: SomedayList = {
            id,
            tabId: input.tabId,
            name: input.name,
            position: input.position,
            createdAt: this.dateProvider.timestamp(),
        };
        this.lists.set(id, list);
        return list;
    }

    async update(id: string, input: UpdateSomedayListInput): Promise<SomedayList | null> {
        const existing = this.lists.get(id);
        if (!existing) return null;
        const updated: SomedayList = { ...existing, ...input };
        this.lists.set(id, updated);
        return updated;
    }

    async replaceAll(lists: SomedayList[]): Promise<void> {
        this.lists.clear();
        for (const list of lists) {
            this.lists.set(list.id, { ...list });
        }
        this.idCounter = lists.reduce(
            (max, list) => Math.max(max, Number.parseInt(list.id, 10) || 0),
            0,
        );
    }

    async delete(id: string): Promise<boolean> {
        return this.lists.delete(id);
    }

    async deleteAll(): Promise<void> {
        this.lists.clear();
        this.idCounter = 0;
    }
}
