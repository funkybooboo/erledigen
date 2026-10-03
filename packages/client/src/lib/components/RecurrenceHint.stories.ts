import { parseRecurrence } from '@erledigen/shared';
import type { Meta, StoryObj } from '@storybook/sveltekit';
import RecurrenceHint from '$lib/components/RecurrenceHint.svelte';

const meta: Meta<typeof RecurrenceHint> = {
    title: 'Components/RecurrenceHint',
    component: RecurrenceHint,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RecurrenceHint>;

export const Default: Story = {
    args: {
        parsed: parseRecurrence('water plants every friday at 4:00pm'),
    },
};

export const Simple: Story = {
    args: {
        parsed: parseRecurrence('meditate daily'),
    },
};
