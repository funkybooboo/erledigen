import type { CreateSomedayTabInput, SomedayTab, UpdateSomedayTabInput } from '@erledigen/shared';

/**
 * Repository interface for SomedayTab persistence (USE-16, ADR-011).
 */
export interface SomedayTabRepository {
    findAll(): Promise<SomedayTab[]>;
    findById(id: string): Promise<SomedayTab | null>;
    create(input: CreateSomedayTabInput): Promise<SomedayTab>;
    /** Destructive restore (ADR-009): replace every row with the given
     *  tabs, verbatim (ids and timestamps kept). */
    replaceAll(tabs: SomedayTab[]): Promise<void>;
    update(id: string, input: UpdateSomedayTabInput): Promise<SomedayTab | null>;
    delete(id: string): Promise<boolean>;
}
