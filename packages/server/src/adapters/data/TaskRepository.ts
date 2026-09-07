/**
 * Repository interface for Task persistence
 *
 * This interface defines the contract for task data access.
 * Implementations can be in-memory, SQL, NoSQL, etc.
 *
 * Following the Repository pattern, this abstraction allows us to:
 * - Swap database implementations without changing business logic
 * - Test with in-memory or SQLite implementations
 * - Keep domain logic separate from data access
 */

import type { CreateTaskInput, Task, UpdateTaskInput } from '@erledigen/shared';

/**
 * Task repository interface
 */
export interface TaskRepository {
    findAll(): Promise<Task[]>;
    findByDate(date: string): Promise<Task[]>;
    findById(id: string): Promise<Task | null>;
    create(input: CreateTaskInput): Promise<Task>;
    /** Bulk create for additive imports: sequential ids, rows returned in
     *  input order. SQLite wraps the inserts in one transaction. */
    createMany(inputs: CreateTaskInput[]): Promise<Task[]>;
    /** Destructive restore (ADR-009): delete every row, insert these rows
     *  verbatim -- ids, timestamps, completion, and the trash all kept
     *  as-is. Next create() ids must never collide with restored ids. */
    replaceAll(tasks: Task[]): Promise<void>;
    update(id: string, input: UpdateTaskInput): Promise<Task | null>;
    delete(id: string): Promise<boolean>;
    findSomeday(): Promise<Task[]>;
    findBySomeDayGroup(groupId: string): Promise<Task[]>;
    findByRecurringTaskId(recurringTaskId: string): Promise<Task[]>;
    findChildren(parentId: string): Promise<Task[]>;
    findByTags(tags: string[]): Promise<Task[]>;
    forceDelete(id: string): Promise<boolean>;
    restore(id: string): Promise<Task | null>;
    findDeleted(maxAgeDays?: number): Promise<Task[]>;
    purgeDeleted(maxAgeDays?: number): Promise<number>;
    /** Number of active (not soft-deleted) tasks. Used by the tasks_total
     *  gauge and the health endpoint (see ADR-005). */
    count(): Promise<number>;
    /** Incomplete tasks eligible for rollover to `today`: scheduled before
     *  `today`, rollover enabled, not deleted, and NOT recurring instances
     *  (their occurrence date is fixed by instanceDate; migrating them
     *  would duplicate today's generated instance). */
    findRolloverCandidates(today: string): Promise<Task[]>;
    /** Move a task to `nextDate` and record its rollover bookkeeping.
     *  Rollover is the only writer of originalScheduledDate/daysLate:
     *  `originalScheduledDate` is the date it was FIRST scheduled for
     *  (preserved across repeats), `daysLate` counts from that date to
     *  `nextDate`. */
    rolloverTask(
        id: string,
        nextDate: string,
        originalScheduledDate: string,
        daysLate: number,
    ): Promise<Task | null>;
}
