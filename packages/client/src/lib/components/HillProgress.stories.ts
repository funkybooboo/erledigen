import type { Meta, StoryObj } from '@storybook/sveltekit';
import HillProgress from './HillProgress.svelte';

const meta: Meta<typeof HillProgress> = {
    title: 'Components/HillProgress',
    component: HillProgress,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof HillProgress>;

export const Uphill: Story = {
    args: { projectId: 'p-story', position: 20 },
};

export const ScopeSettled: Story = {
    args: { projectId: 'p-story', position: 50 },
};

export const Executing: Story = {
    args: { projectId: 'p-story', position: 80 },
};
