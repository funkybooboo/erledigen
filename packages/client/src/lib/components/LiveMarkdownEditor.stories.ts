import type { Meta, StoryObj } from '@storybook/sveltekit';
import LiveMarkdownEditor from '$lib/components/LiveMarkdownEditor.svelte';

const meta: Meta<typeof LiveMarkdownEditor> = {
    title: 'Components/LiveMarkdownEditor',
    component: LiveMarkdownEditor,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof LiveMarkdownEditor>;

// The editor is controlled (value in, onchange out); stories echo the
// change back so interactive editing works in the canvas.
const echo = {
    onchange: (value: string) => {
        // Storybook args cannot be rebound from a plain callback in a
        // static story -- this exists so the canvas shows no console
        // errors; the rendered value is the args' value.
        void value;
    },
};

export const Empty: Story = {
    args: {
        value: '',
        placeholder: 'Add notes -- # headings, **bold**, - lists',
        ...echo,
    },
};

export const Paragraph: Story = {
    args: {
        value: 'A plain margin jot.',
        ...echo,
    },
};

export const FullGrammar: Story = {
    args: {
        value: [
            '# Morning',
            '',
            '- water **the basil**',
            '- email *Dana* about `the plan`',
            '  - nested item',
            '',
            '```js',
            'const done = true;',
            '```',
            '',
            'Read [the docs](https://example.com).',
        ].join('\n'),
        ...echo,
    },
};
