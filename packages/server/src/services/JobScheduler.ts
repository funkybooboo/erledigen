/**
 * Recurring job scheduling (v0.8.0, see ADR-002)
 *
 * Keeps exactly one queued job per recurring type at any time:
 *  - at startup, a missed daily run is caught up immediately (the server
 *    may have been down at the scheduled time -- a laptop that boots at
 *    9am must not wait until midnight to roll tasks over);
 *  - after each run, the next occurrence is scheduled ("chain
 *    scheduling"), so no separate cron state exists beyond the queue.
 *
 * The rollover schedule follows user preferences (on/off + trigger time);
 * the purge job runs daily at 03:00 regardless (retention hygiene).
 * Trigger times are computed in the SERVER's timezone (docker TZ) -- user
 * zone-aware scheduling is future work once preferences.timezone is wired
 * into the server's date provider.
 */

import type { DateProvider, Logger } from '@erledigen/shared';
import type { UserPreferencesRepository } from '../adapters/data/UserPreferencesRepository';
import type { Job, JobQueue } from '../adapters/jobs/JobQueue';

/** The rollover job payload: tasks roll TO this date. */
export interface RolloverJobPayload {
    date: string;
}

const PURGE_HOUR = 3;

/** True when the job is a rollover for the given date. */
function isRolloverFor(job: Job, date: string): boolean {
    if (typeof job.payload !== 'object' || job.payload === null) return false;
    const payload = job.payload as Partial<RolloverJobPayload>;
    return payload.date === date;
}

/** Pending, retry-scheduled, or running -- i.e. not settled yet. */
function isActive(job: Job): boolean {
    return job.status === 'pending' || job.status === 'failed' || job.status === 'running';
}

export class JobScheduler {
    constructor(
        private readonly jobQueue: JobQueue,
        private readonly preferencesRepository: UserPreferencesRepository,
        private readonly dateProvider: DateProvider,
        private readonly logger: Logger,
    ) {}

    /**
     * Ensure the rollover job is scheduled per preferences:
     * - disabled: cancel queued rollovers (never a running one -- the
     *   runner owns it mid-flight and its next queue write would fail);
     * - behind (no run for today, none queued or in flight): catch up now;
     * - otherwise: ensure the next daily occurrence is queued.
     */
    async ensureRolloverScheduled(): Promise<void> {
        const prefs = await this.preferencesRepository.get();
        const recent = await this.jobQueue.findRecentByType('rollover', 20);
        const active = recent.filter(isActive);

        if (!prefs.rolloverEnabled) {
            for (const job of active) {
                if (job.status !== 'running') await this.jobQueue.cancel(job.id);
            }
            return;
        }

        const today = this.dateProvider.today();
        const ranForToday = recent.some(
            job => job.status === 'completed' && isRolloverFor(job, today),
        );
        const inFlightForToday = active.some(job => isRolloverFor(job, today));

        if (!ranForToday && !inFlightForToday) {
            // Missed the scheduled time (server was down): run now.
            const job = await this.jobQueue.schedule('rollover', { date: today }, new Date());
            this.logger.info('Rollover catch-up scheduled', { date: today, jobId: job.id });
            return;
        }

        if (prefs.rolloverTriggerTime === 'manual') {
            // No daily schedule; the startup catch-up above is the only
            // automatic run. Remove any queued FUTURE rollover.
            for (const job of active) {
                if (job.status !== 'running' && !isRolloverFor(job, today)) {
                    await this.jobQueue.cancel(job.id);
                }
            }
            return;
        }

        const triggerHour = prefs.rolloverTriggerTime === '9am' ? 9 : 0;
        const nextRun = this.nextDailyOccurrence(triggerHour);
        const nextDate = this.dateProvider.dateFromTimestamp(nextRun.toISOString());
        if (!active.some(job => isRolloverFor(job, nextDate))) {
            await this.jobQueue.schedule('rollover', { date: nextDate }, nextRun);
        }
    }

    /** Ensure a daily trash purge is queued (03:00, retention hygiene).
     *  A job currently RUNNING does not count as queued: the handler calls
     *  this on completion, and by then the running row has settled -- at
     *  the moment of the call it must still see room to schedule the next
     *  occurrence. */
    async ensurePurgeScheduled(): Promise<void> {
        const recent = await this.jobQueue.findRecentByType('purge-deleted', 5);
        const queued = recent.some(job => job.status === 'pending' || job.status === 'failed');
        if (queued) return;

        await this.jobQueue.schedule('purge-deleted', {}, this.nextDailyOccurrence(PURGE_HOUR));
    }

    /** Next wall-clock instant at the given hour (server timezone), at
     *  least a moment in the future. */
    private nextDailyOccurrence(hour: number): Date {
        const next = new Date();
        next.setHours(hour, 0, 0, 0);
        if (next.getTime() <= Date.now()) {
            next.setDate(next.getDate() + 1);
        }
        return next;
    }
}
