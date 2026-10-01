<script lang="ts">
    /**
     * The schedule half of a habit form: frequency, interval, weekday
     * chips, day-of-month, and start time. Extracted from HabitsModal so
     * the task detail modal's "Make recurring" disclosure renders the
     * exact same controls -- the two forms cannot drift.
     *
     * Every prop is bindable; the parent owns the state (and the
     * save/adopt call). Deliberately excludes the habit NAME, start/end
     * dates, and rollover: adopt derives the start from the task, and
     * rollover follows the task's existing setting.
     */
    import { WEEKDAY_ABBREVIATIONS, type RecurringFrequency } from '@erledigen/shared';

    let {
        frequency = $bindable('daily'),
        interval = $bindable(1),
        daysOfWeek = $bindable([]),
        dayOfMonth = $bindable<number | null>(null),
        startTime = $bindable(''),
    }: {
        frequency?: RecurringFrequency;
        interval?: number;
        /** Which weekdays the schedule lands on; empty = any day. */
        daysOfWeek?: number[];
        dayOfMonth?: number | null;
        startTime?: string;
    } = $props();

    const DAY_NAMES = WEEKDAY_ABBREVIATIONS;

    /** Day chips apply to daily and weekly schedules. */
    const usesDaysOfWeek = $derived(frequency === 'daily' || frequency === 'weekly');

    function toggleDay(day: number): void {
        daysOfWeek = daysOfWeek.includes(day)
            ? daysOfWeek.filter(d => d !== day)
            : [...daysOfWeek, day].sort((a, b) => a - b);
    }
</script>

<div class="schedule-form">
    <div class="form-row">
        <label for="habit-frequency">Repeats</label>
        <select id="habit-frequency" bind:value={frequency}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
        </select>
        {#if interval > 1 || frequency !== 'daily'}
            <label for="habit-interval" class="inline-label">every</label>
            <input
                id="habit-interval"
                type="number"
                min="1"
                max="365"
                bind:value={interval}
                aria-label="Interval"
            />
        {/if}
    </div>
    {#if usesDaysOfWeek}
        <div class="form-row">
            <span class="chip-label">On days</span>
            <div class="day-chips" role="group" aria-label="Days of week">
                {#each DAY_NAMES as day, i (i)}
                    <button
                        type="button"
                        class="day-chip"
                        class:active={daysOfWeek.includes(i)}
                        onclick={() => toggleDay(i)}
                        aria-pressed={daysOfWeek.includes(i)}
                    >
                        {day}
                    </button>
                {/each}
            </div>
            {#if daysOfWeek.length === 0}
                <span class="chip-hint">any day</span>
            {/if}
        </div>
    {/if}
    {#if frequency === 'monthly'}
        <div class="form-row">
            <label for="habit-day-of-month">On day of month</label>
            <input
                id="habit-day-of-month"
                type="number"
                min="1"
                max="31"
                bind:value={dayOfMonth}
            />
        </div>
    {/if}
    <div class="form-row">
        <label for="habit-time">Time</label>
        <input type="time" id="habit-time" bind:value={startTime} />
    </div>
</div>

<style>
    .schedule-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .form-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .form-row label {
        font-size: 12px;
        color: var(--color-text-secondary);
        min-width: 64px;
    }

    .form-row .inline-label {
        min-width: 0;
    }

    .form-row select,
    .form-row input[type='number'],
    .form-row input[type='time'] {
        padding: 4px 8px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-surface);
        color: var(--color-text);
        font-size: 13px;
    }

    .form-row select:focus,
    .form-row input:focus {
        outline: none;
        border-color: var(--color-border-focus);
    }

    .form-row input[type='number'],
    .form-row input[type='time'] {
        width: 76px;
    }

    .day-chips {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
    }

    .day-chip {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid var(--color-border);
        background: var(--color-surface);
        color: var(--color-text-muted);
        cursor: pointer;
        transition: background-color 0.1s, color 0.1s, border-color 0.1s;
    }

    .day-chip:hover {
        background: var(--color-surface-hover);
        color: var(--color-text);
    }

    .day-chip.active {
        background: var(--color-accent-light);
        color: var(--color-accent);
        border-color: var(--color-accent);
    }

    .chip-label {
        font-size: 12px;
        color: var(--color-text-secondary);
        min-width: 64px;
    }

    .chip-hint {
        font-size: 11px;
        color: var(--color-text-muted);
    }
</style>