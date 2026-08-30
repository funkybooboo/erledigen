/**
 * Generic CRUD store shared by the simple entity stores
 * (projects, someday-groups, recurring tasks).
 *
 * Holds a `$state` list of entities keyed by `id` and provides the common
 * fetchAll / create / update / remove flow with uniform null/boolean return
 * semantics and "keep current state on error" handling. Subclasses:
 *   - expose a domain-specific read accessor (e.g. `get projects()` -> items)
 *   - may override `sort()` to impose a display order on fetched/created lists
 *   - may add WebSocket sync on top (see projectStore)
 *
 * The concrete client services satisfy the `CrudService` contract structurally
 * and may carry additional methods beyond these four.
 */

export interface CrudService<T extends { id: string }, CreateInput, UpdateInput> {
    getAll(): Promise<T[]>;
    create(input: CreateInput): Promise<T>;
    update(id: string, input: UpdateInput): Promise<T>;
    delete(id: string): Promise<void>;
}

export class EntityStore<T extends { id: string }, CreateInput, UpdateInput> {
    items = $state<T[]>([]);

    constructor(protected service: CrudService<T, CreateInput, UpdateInput>) {}

    /** Override to impose a display order on fetched/created lists. */
    protected sort(items: T[]): T[] {
        return items;
    }

    async fetchAll(): Promise<void> {
        try {
            this.items = this.sort(await this.service.getAll());
        } catch {
            // Keep current state
        }
    }

    async create(input: CreateInput): Promise<T | null> {
        try {
            const item = await this.service.create(input);
            this.items = this.sort([...this.items, item]);
            return item;
        } catch {
            return null;
        }
    }

    async update(id: string, input: UpdateInput): Promise<T | null> {
        try {
            const updated = await this.service.update(id, input);
            this.items = this.items.map(i => (i.id === id ? updated : i));
            return updated;
        } catch {
            return null;
        }
    }

    async remove(id: string): Promise<boolean> {
        try {
            await this.service.delete(id);
            this.items = this.items.filter(i => i.id !== id);
            return true;
        } catch {
            return false;
        }
    }
}
