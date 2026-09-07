import type {
    CreateRecurringTaskInput,
    RecurringTask,
    RecurringTaskStats,
    UpdateRecurringTaskInput,
} from '@erledigen/shared';

/**
 * Repository interface for RecurringTask persistence
 */
export interface RecurringTaskRepository {
    findAll(): Promise<RecurringTask[]>;
    findById(id: string): Promise<RecurringTask | null>;
    create(input: CreateRecurringTaskInput): Promise<RecurringTask>;
    /** Destructive restore (ADR-009): replace every row with the given
     *  templates, verbatim (ids and timestamps kept). */
    replaceAll(recurringTasks: RecurringTask[]): Promise<void>;
    update(id: string, input: UpdateRecurringTaskInput): Promise<RecurringTask | null>;
    delete(id: string): Promise<boolean>;
    findStats(recurringTaskId: string): Promise<RecurringTaskStats | null>;
    upsertStats(stats: RecurringTaskStats): Promise<void>;
}
