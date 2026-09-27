import { addDays } from '@erledigen/shared';
import type { Meta, StoryObj } from '@storybook/sveltekit';
import HabitHeatmap from '$lib/components/HabitHeatmap.svelte';

const meta: Meta<typeof HabitHeatmap> = {
    title: 'Components/HabitHeatmap',
    component: HabitHeatmap,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof HabitHeatmap>;

/** Fixed "today" so stories are deterministic regardless of run date. */
const TODAY = '2026-09-27';

/** Completed every day for a stretch of days ending today. */
function dailyStreak(startOffset: number, endOffset: number): string[] {
    const dates: string[] = [];
    for (let offset = startOffset; offset <= endOffset; offset++) {
        dates.push(addDays(TODAY, offset));
    }
    return dates;
}

export const Default: Story = {
    args: {
        today: TODAY,
        completedDates: dailyStreak(-30, 0),
    },
};

/** No completions yet -- every past cell is level-0. */
export const Empty: Story = {
    args: {
        today: TODAY,
        completedDates: [],
    },
};

/** Sparse history: a weekly habit completed over the whole year. */
export const SparseWeekly: Story = {
    args: {
        today: TODAY,
        completedDates: dailyStreak(-364, 0).filter((_, i) => i % 7 === 0),
    },
};

/** Nearly the whole year completed. */
export const Dense: Story = {
    args: {
        today: TODAY,
        completedDates: dailyStreak(-364, 0).filter((_, i) => i % 30 !== 3),
    },
};

/** A shorter grid: 12 weeks instead of the full year. */
export const TwelveWeeks: Story = {
    args: {
        today: TODAY,
        weeks: 12,
        completedDates: dailyStreak(-84, 0),
    },
};
