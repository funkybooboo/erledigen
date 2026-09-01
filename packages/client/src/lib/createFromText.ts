/**
 * Create a task — or, when the text ends with a recurrence phrase, a habit —
 * from free-form text.
 *
 * Shared by the inline add inputs and the search/command palette's "/add"
 * command so both go through the same TeuxDeux-style parseRecurrence path.
 */

import type { RecurrenceSchedule, RecurringTask, Task } from '@erledigen/shared';
import { parseRecurrence } from '@erledigen/shared';
import { container } from '$lib/container';
import { GENERATE_HORIZON_DAYS, recurringTaskStore, taskStore } from '$lib/stores';

export interface CreateFromTextOptions {
    /** Schedule date for a plain task (empty string = Someday) and the
     *  start date fallback for a habit (defaults to today). */
    date?: string;
    /** Someday group for a plain task. */
    someDayGroupId?: string | null;
}

export type CreatedFromText =
    | { kind: 'habit'; habit: RecurringTask; tasks: Task[]; schedule: RecurrenceSchedule }
    | { kind: 'task'; task: Task };

function horizonEnd(from: string): string {
    const d = new Date(`${from}T00:00:00`);
    d.setDate(d.getDate() + GENERATE_HORIZON_DAYS);
    return d.toISOString().split('T')[0] ?? from;
}

/**
 * Parse and create from raw text. Returns null when the text is empty or
 * creation failed.
 */
export async function createFromText(
    rawText: string,
    options: CreateFromTextOptions = {},
): Promise<CreatedFromText | null> {
    const text = rawText.trim();
    if (!text) return null;

    const parsed = parseRecurrence(text);
    if (parsed) {
        const startDate = options.date || container.dateProvider.today();
        const result = await recurringTaskStore.createAndGenerate(
            {
                text: parsed.cleanText,
                frequency: parsed.schedule.frequency,
                interval: parsed.schedule.interval,
                daysOfWeek: parsed.schedule.daysOfWeek,
                dayOfMonth: parsed.schedule.dayOfMonth,
                startTime: parsed.schedule.startTime,
                startDate,
            },
            horizonEnd(startDate),
        );
        if (!result) return null;
        taskStore.ingest(result.tasks);
        return {
            kind: 'habit',
            habit: result.habit,
            tasks: result.tasks,
            schedule: parsed.schedule,
        };
    }

    const input: Record<string, unknown> = { text, date: options.date || null };
    if (options.someDayGroupId) input.someDayGroupId = options.someDayGroupId;
    const task = await taskStore.create(input as Parameters<typeof taskStore.create>[0]);
    return task ? { kind: 'task', task } : null;
}
