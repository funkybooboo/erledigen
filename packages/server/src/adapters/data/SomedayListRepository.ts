import type {
    CreateSomedayListInput,
    SomedayList,
    UpdateSomedayListInput,
} from '@erledigen/shared';

/**
 * Repository interface for SomedayList persistence (USE-16, ADR-011).
 */
export interface SomedayListRepository {
    findAll(): Promise<SomedayList[]>;
    findById(id: string): Promise<SomedayList | null>;
    create(input: CreateSomedayListInput): Promise<SomedayList>;
    /** Destructive restore (ADR-009): replace every row with the given
     *  lists, verbatim (ids and timestamps kept). */
    replaceAll(lists: SomedayList[]): Promise<void>;
    update(id: string, input: UpdateSomedayListInput): Promise<SomedayList | null>;
    delete(id: string): Promise<boolean>;
}
