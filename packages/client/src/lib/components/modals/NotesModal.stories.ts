import type { Meta, StoryObj } from '@storybook/sveltekit';
import NotesModal from './NotesModal.svelte';

const meta: Meta<typeof NotesModal> = {
    title: 'Components/Modals/NotesModal',
    component: NotesModal,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof NotesModal>;

export const Default: Story = {};
