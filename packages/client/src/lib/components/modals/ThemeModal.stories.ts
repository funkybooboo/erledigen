import type { Meta, StoryObj } from '@storybook/sveltekit';
import ThemeModal from '$lib/components/modals/ThemeModal.svelte';

const meta: Meta<typeof ThemeModal> = {
    title: 'Components/Modals/ThemeModal',
    component: ThemeModal,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ThemeModal>;

export const Default: Story = {};

export const DarkTheme: Story = {
    parameters: {
        stores: {
            preferencesStore: { theme: 'dark' },
        },
    },
};
