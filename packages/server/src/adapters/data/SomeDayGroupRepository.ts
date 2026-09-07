import type {
    CreateSomeDayGroupInput,
    SomeDayGroup,
    UpdateSomeDayGroupInput,
} from '@erledigen/shared';

/**
 * Repository interface for SomeDayGroup persistence
 */
export interface SomeDayGroupRepository {
    findAll(): Promise<SomeDayGroup[]>;
    findById(id: string): Promise<SomeDayGroup | null>;
    create(input: CreateSomeDayGroupInput): Promise<SomeDayGroup>;
    /** Destructive restore (ADR-009): replace every row with the given
     *  groups, verbatim (ids and timestamps kept). */
    replaceAll(groups: SomeDayGroup[]): Promise<void>;
    update(id: string, input: UpdateSomeDayGroupInput): Promise<SomeDayGroup | null>;
    delete(id: string): Promise<boolean>;
}
