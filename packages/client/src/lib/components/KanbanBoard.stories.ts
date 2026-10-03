import type { Project, Task } from '@erledigen/shared';
import type { Meta, StoryObj } from '@storybook/sveltekit';
import KanbanBoard from '$lib/components/KanbanBoard.svelte';
import { mockTask } from '$lib/stories/mockData';

const meta: Meta<typeof KanbanBoard> = {
    title: 'Components/KanbanBoard',
    component: KanbanBoard,
    tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof KanbanBoard>;

const project: Project = {
    id: 'p1',
    name: 'Launch website',
    tag: 'project:launch-website',
    description: 'Ship the new marketing site',
    startDate: '2026-05-01',
    dueDate: '2026-05-14',
    isActive: true,
    createdAt: '2026-04-01T09:00:00Z',
    completedAt: null,
};

function task(overrides: Partial<Task> & Pick<Task, 'id' | 'text'>): Task {
    return { ...mockTask, tags: [project.tag], ...overrides };
}

const tasks: Task[] = [
    task({ id: 't1', text: 'Write copy', date: null }),
    task({ id: 't2', text: 'Pick fonts', date: null }),
    task({ id: 't3', text: 'Design hero', date: '2026-05-02' }),
    task({ id: 't4', text: 'Blocked: DNS setup', date: null, dependsOn: 't3' }),
    task({ id: 't5', text: 'Register domain', date: '2026-05-01', completed: true }),
    task({ id: 't6', text: 'Sub-task stays hidden', date: null, parentId: 't1' }),
];

/** One card per column, a blocked card, and a scheduled date input. */
export const Default: Story = {
    args: { project, tasks },
};

/** An inactive project: the toolbar offers Activate alongside
 *  Auto-distribute. */
export const Inactive: Story = {
    args: {
        project: { ...project, isActive: false, startDate: null, dueDate: null },
        tasks,
    },
};
