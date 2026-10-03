/**
 * Create a task -- or, when the text ends with a recurrence phrase, a habit --
 * from free-form text.
 *
 * Shared by the inline add inputs and the search/command palette's "/add"
 * command so both go through the same TeuxDeux-style parseRecurrence path.
 * Task text may also carry a natural-language date ("buy milk tomorrow")
 * and #tags ("#work #p1"); both are extracted and applied to the created
 * task. A typed date phrase overrides the surface's default date.
 */

import type { CreateTaskInput, RecurrenceSchedule, RecurringTask, Task } from '@erledigen/shared';
import {
    addDays,
    describeRecurrence,
    extractDatePhrase,
    extractInlineTags,
    parseRecurrence,
} from '@erledigen/shared';
import { container } from '$lib/container';
import { GENERATE_HORIZON_DAYS, recurringTaskStore, taskStore } from '$lib/stores';

interface CreateFromTextOptions {
    /** Schedule date for a plain task (empty string = Someday) and the
     *  start date fallback for a habit (defaults to today). */
    date?: string;
    /** Someday group for a plain task. */
    someDayGroupId?: string | null;
}

type CreatedFromText =
    | { kind: 'habit'; habit: RecurringTask; tasks: Task[]; schedule: RecurrenceSchedule }
    | { kind: 'task'; task: Task };

/** The generation horizon end key: pure dateKeys math (no Date round-trip
 *  through toISOString, which shifts a day in positive UTC offsets). */
function horizonEnd(from: string): string {
    return addDays(from, GENERATE_HORIZON_DAYS);
}

/** Toast copy for a created habit, shared by both entry points so the
 *  wording (and its e2e assertions) can never drift apart. */
export function habitCreatedText(schedule: RecurrenceSchedule): string {
    return `Habit created -- ${describeRecurrence(schedule)}`;
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

    // Natural-language date + #tags: "buy milk tomorrow #work #p1" becomes
    // text "buy milk", date tomorrow, tags [work, p1]. The typed phrase wins
    // over the surface's default date (the user typed it deliberately);
    // a Someday input (date: "") with a phrase schedules the task.
    const datePhrase = extractDatePhrase(text, container.dateProvider.today());
    const stripped = datePhrase ? datePhrase.rest : text;
    const inlineTags = extractInlineTags(stripped);

    const input: CreateTaskInput = {
        text: inlineTags.text,
        date: datePhrase ? datePhrase.date : options.date || null,
    };
    if (inlineTags.tags.length > 0) input.tags = inlineTags.tags;
    if (options.someDayGroupId) input.someDayGroupId = options.someDayGroupId;
    const task = await taskStore.create(input);
    return task ? { kind: 'task', task } : null;
}
