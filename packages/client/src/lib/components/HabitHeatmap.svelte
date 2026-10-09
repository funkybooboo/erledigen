<script lang="ts">
    /**
     * GitHub-style completion heatmap for one habit: one column per week,
     * one cell per day, colored by how many completions landed on that
     * date. The grid always covers the trailing weeks ending today (the
     * server bounds completedDates to the same window, so every cell the
     * grid draws is backed by data).
     *
     * Pure presentation: it takes the dates and renders them. The Habits
     * modal fetches the stats; this component never talks to a store.
     */
    import {
        HABIT_HEATMAP_WEEKS,
        addDays,
        monthKeyOf,
        splitKey,
        weekdayOf,
        WEEKDAY_ABBREVIATIONS,
    } from '@erledigen/shared';

    let {
        completedDates,
        today,
        weeks = HABIT_HEATMAP_WEEKS,
    }: {
        /** ISO dates of completed occurrences inside the window. */
        completedDates: string[];
        /** ISO date treated as today (rendered with an outline). */
        today: string;
        /** Column count; the grid draws `weeks` weeks ending this week. */
        weeks?: number;
    } = $props();

    const completedCounts = $derived.by(() => {
        const counts = new Map<string, number>();
        for (const date of completedDates) {
            counts.set(date, (counts.get(date) ?? 0) + 1);
        }
        return counts;
    });

    /** First grid cell: the Sunday `weeks - 1` weeks before today's
     *  week. Anchoring on today's week (not a fixed day-count back)
     *  keeps today inside the grid -- a naive "Sunday of today -
     *  (weeks*7 - 1)" lands the last cell on yesterday whenever today
     *  is itself a Sunday, dropping today's completion. */
    const firstCell = $derived.by(() => {
        const thisSunday = addDays(today, -weekdayOf(today));
        return addDays(thisSunday, -(weeks - 1) * 7);
    });

    interface Cell {
        key: string;
        /** 0-4 intensity level from the day's completion count. */
        level: number;
        state: 'past' | 'today' | 'future';
        title: string;
    }

    interface WeekColumn {
        /** Month abbreviation shown above this column, or null. */
        label: string | null;
        days: Cell[];
    }

    function levelFor(date: string): number {
        const count = completedCounts.get(date) ?? 0;
        if (count >= 7) return 4;
        if (count >= 4) return 3;
        if (count >= 2) return 2;
        return count >= 1 ? 1 : 0;
    }

    function monthAbbreviation(key: string): string {
        const [, monthIndex] = splitKey(key);
        return new Date(Date.UTC(2026, monthIndex, 1)).toLocaleString('en-US', {
            month: 'short',
            timeZone: 'UTC',
        });
    }

    const columns = $derived.by(() => {
        const out: WeekColumn[] = [];
        let previousMonth = '';
        for (let w = 0; w < weeks; w++) {
            const sunday = addDays(firstCell, w * 7);
            const month = monthKeyOf(sunday);
            const label = month !== previousMonth ? monthAbbreviation(sunday) : null;
            previousMonth = month;

            const days: Cell[] = [];
            for (let d = 0; d < 7; d++) {
                const key = addDays(sunday, d);
                const level = levelFor(key);
                const state = key === today ? 'today' : key < today ? 'past' : 'future';
                days.push({
                    key,
                    level,
                    state,
                    title:
                        state === 'future'
                            ? `${key}`
                            : level > 0
                              ? `${key} -- ${completedCounts.get(key)} completed`
                              : `${key} -- no completion`,
                });
            }
            out.push({ label, days });
        }
        return out;
    });

    const totalCompletions = $derived(
        columns
            .flatMap(col => col.days)
            .filter(cell => cell.level > 0 && cell.state !== 'future')
            .length,
    );

    /** Weekday labels down the left edge, GitHub-style (Mon/Wed/Fri). */
    const labelRows = [1, 3, 5];
</script>

<div
    class="heatmap"
    style="--heatmap-weeks: {weeks}"
    role="img"
    aria-label="Completion heatmap: {totalCompletions} completions in the last {weeks} weeks"
>
    <!-- Decorative grid: the wrapper's aria-label summarizes it, so
         screen readers skip the hundreds of cell titles. -->
    <div class="grid-scroll" aria-hidden="true">
        <div class="months-row">
            <span class="weekday-gutter"></span>
            {#each columns as column (column.days[0]?.key)}
                <span class="month-label">{column.label ?? ''}</span>
            {/each}
        </div>
        <div class="grid-body">
            <div class="weekday-labels">
                {#each Array(7) as _, row}
                    {#if labelRows.includes(row)}
                        <span>{WEEKDAY_ABBREVIATIONS[row]}</span>
                    {:else}
                        <span></span>
                    {/if}
                {/each}
            </div>
            {#each columns as column (column.days[0]?.key)}
                <div class="week">
                    {#each column.days as cell (cell.key)}
                        <span
                            class="cell level-{cell.level}"
                            class:future={cell.state === 'future'}
                            class:today={cell.state === 'today'}
                            title={cell.title}
                        ></span>
                    {/each}
                </div>
            {/each}
        </div>
    </div>
    <div class="legend">
        <span>Less</span>
        <span class="cell level-0" title="No completion"></span>
        <span class="cell level-1" title="1 completion"></span>
        <span class="cell level-2" title="2-3 completions"></span>
        <span class="cell level-3" title="4-6 completions"></span>
        <span class="cell level-4" title="7+ completions"></span>
        <span>More</span>
    </div>
</div>

<style>
    .heatmap {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    /* The year grid is wider than the modal on small screens; scroll
     * horizontally instead of shrinking cells below legibility. */
    .grid-scroll {
        overflow-x: auto;
    }

    .months-row,
    .grid-body {
        display: grid;
        grid-template-columns: auto repeat(var(--heatmap-weeks), 12px);
        gap: 3px;
        width: max-content;
        margin: 0 auto;
    }

    .months-row {
        margin-bottom: 2px;
    }

    .month-label {
        font-size: 10px;
        color: var(--color-text-secondary);
        white-space: nowrap;
    }

    .weekday-gutter {
        width: 26px;
    }

    .grid-body {
        align-items: stretch;
    }

    .weekday-labels {
        display: grid;
        grid-template-rows: repeat(7, 12px);
        gap: 3px;
    }

    .weekday-labels span {
        font-size: 10px;
        color: var(--color-text-secondary);
        height: 12px;
        line-height: 12px;
        text-align: right;
        width: 22px;
    }

    .week {
        display: grid;
        grid-template-rows: repeat(7, 12px);
        gap: 3px;
    }

    .cell {
        width: 12px;
        height: 12px;
        border-radius: 3px;
        background: var(--color-surface-hover);
        border: 1px solid transparent;
    }

    .cell.level-1 {
        background: color-mix(in oklch, var(--color-success) 35%, var(--color-surface));
    }

    .cell.level-2 {
        background: color-mix(in oklch, var(--color-success) 60%, var(--color-surface));
    }

    .cell.level-3 {
        background: color-mix(in oklch, var(--color-success) 80%, var(--color-surface));
    }

    .cell.level-4 {
        background: var(--color-success);
    }

    .cell.future {
        background: transparent;
        border-color: var(--color-border);
    }

    .cell.today {
        border-color: var(--color-border-focus);
    }

    .legend {
        display: flex;
        align-items: center;
        gap: 3px;
        justify-content: flex-end;
        font-size: 10px;
        color: var(--color-text-secondary);
    }

    .legend .cell {
        width: 10px;
        height: 10px;
    }

    @media (prefers-reduced-motion: no-preference) {
        .cell {
            transition: background-color 120ms ease;
        }
    }
</style>
