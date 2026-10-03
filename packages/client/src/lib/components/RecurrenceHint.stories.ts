import { type ParsedRecurrence, parseRecurrence } from '@erledigen/shared';
import type { Meta, StoryObj } from '@storybook/sveltekit';
import RecurrenceHint from '$lib/components/RecurrenceHint.svelte';

const meta: Meta<typeof RecurrenceHint> = {
    title: 'Components/RecurrenceHint',
    component: RecurrenceHint,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RecurrenceHint>;

/** parseRecurrence returns null for a non-recurrence phrase; stories need
 *  the parsed schedule, so fail loudly if a fixture stops parsing. */
function mustParse(phrase: string): ParsedRecurrence {
    const parsed = parseRecurrence(phrase);
    if (!parsed) throw new Error(`story fixture failed to parse: ${phrase}`);
    return parsed;
}

export const Default: Story = {
    args: {
        parsed: mustParse('water plants every friday at 4:00pm'),
    },
};

export const Simple: Story = {
    args: {
        parsed: mustParse('meditate daily'),
    },
};
