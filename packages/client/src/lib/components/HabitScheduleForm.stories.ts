import type { Meta, StoryObj } from '@storybook/sveltekit';
import HabitScheduleForm from '$lib/components/HabitScheduleForm.svelte';

const meta: Meta<typeof HabitScheduleForm> = {
    title: 'Components/HabitScheduleForm',
    component: HabitScheduleForm,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof HabitScheduleForm>;

/** The default adopt state: daily, every 1, any day, no time. */
export const Default: Story = {
    args: {
        frequency: 'daily',
        interval: 1,
        daysOfWeek: [],
        dayOfMonth: null,
        startTime: '',
    },
};

/** Daily with weekday chips selected (an "every weekday" habit). */
export const Weekdays: Story = {
    args: {
        frequency: 'daily',
        interval: 1,
        daysOfWeek: [1, 2, 3, 4, 5],
        dayOfMonth: null,
        startTime: '',
    },
};

/** Weekly every 2 with a start time. */
export const BiweeklyTimed: Story = {
    args: {
        frequency: 'weekly',
        interval: 2,
        daysOfWeek: [5],
        dayOfMonth: null,
        startTime: '16:00',
    },
};

/** Monthly schedules show the day-of-month input instead of chips. */
export const Monthly: Story = {
    args: {
        frequency: 'monthly',
        interval: 1,
        daysOfWeek: [],
        dayOfMonth: 15,
        startTime: '',
    },
};
