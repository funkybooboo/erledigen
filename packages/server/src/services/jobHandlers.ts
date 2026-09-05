/**
 * Background job handlers (v0.8.0, see ADR-002)
 *
 * One handler per job type, registered with the JobRunner before start.
 * Each recurring handler chain-schedules its next occurrence through the
 * JobScheduler when it finishes, so the queue itself is the only cron
 * state.
 */

import { type DateProvider, type Logger, PURGE_RETENTION_DAYS } from '@erledigen/shared';
import type { TaskRepository } from '../adapters/data/TaskRepository';
import type { JobRunner } from './JobRunner';
import type { JobScheduler, RolloverJobPayload } from './JobScheduler';
import type { RolloverService } from './RolloverService';

/** Type guard: the rollover payload must carry a target date. */
function isRolloverPayload(payload: unknown): payload is RolloverJobPayload {
    return (
        typeof payload === 'object' &&
        payload !== null &&
        'date' in payload &&
        typeof payload.date === 'string'
    );
}

export function registerJobHandlers(
    runner: JobRunner,
    deps: {
        rolloverService: RolloverService;
        taskRepository: TaskRepository;
        scheduler: JobScheduler;
        dateProvider: DateProvider;
        logger: Logger;
    },
): void {
    runner.register('rollover', {
        handle: async job => {
            if (!isRolloverPayload(job.payload)) {
                // Malformed payload: fail the job (retry/dead path applies)
                // rather than silently skipping a day of rollover.
                throw new Error('Rollover job payload must carry a date string');
            }
            const result = await deps.rolloverService.rollover(job.payload.date);
            deps.logger.info('Rollover completed', {
                date: result.date,
                rolledCount: result.rolledCount,
            });
            // Chain-schedule the next occurrence (also catches preference
            // changes: a disabled toggle cancels queued rollovers).
            await deps.scheduler.ensureRolloverScheduled();
        },
    });

    runner.register('purge-deleted', {
        handle: async () => {
            const purged = await deps.taskRepository.purgeDeleted(PURGE_RETENTION_DAYS);
            if (purged > 0) {
                deps.logger.info('Trash purged', { purged, retentionDays: PURGE_RETENTION_DAYS });
            }
            await deps.scheduler.ensurePurgeScheduled();
        },
    });
}
