/**
 * Task rollover (v0.8.0, see ADR-002 job types)
 *
 * Moves incomplete tasks from past days to the target date, preserving the
 * FIRST scheduled date (originalScheduledDate) and counting daysLate from
 * it. Idempotent: after a run for date D, no task has date < D anymore, so
 * a second run for D is a no-op -- which is what makes the boot catch-up
 * and the daily schedule safe to overlap.
 */

import type { DateProvider, Task } from '@erledigen/shared';
import type { TaskRepository } from '../adapters/data/TaskRepository';

export interface RolloverResult {
    /** The date tasks were rolled TO. */
    date: string;
    rolledCount: number;
    /** The rolled tasks in their new state (post-move). */
    tasks: Task[];
}

export class RolloverService {
    constructor(
        private readonly taskRepo: TaskRepository,
        private readonly dateProvider: DateProvider,
    ) {}

    async rollover(today: string): Promise<RolloverResult> {
        const candidates = await this.taskRepo.findRolloverCandidates(today);
        const tasks: Task[] = [];
        for (const task of candidates) {
            // Preserve the FIRST scheduled date across repeat rollovers:
            // daysLate keeps counting from when the task was originally
            // planned, not from the day it most recently slipped.
            const originalScheduledDate = task.originalScheduledDate ?? task.date ?? today;
            const daysLate = Math.max(
                0,
                this.dateProvider.daysBetween(originalScheduledDate, today),
            );
            const rolled = await this.taskRepo.rolloverTask(
                task.id,
                today,
                originalScheduledDate,
                daysLate,
            );
            if (rolled !== null) tasks.push(rolled);
        }
        return { date: today, rolledCount: tasks.length, tasks };
    }
}
