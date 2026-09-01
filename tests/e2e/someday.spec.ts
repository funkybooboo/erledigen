import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { cleanup, createTask, uniq } from '../api-tests/helpers';
import { hydrated, SERVER_URL, todayISO } from './util';

const PREFIX = 'SomedayE2E';

/**
 * Groups and someday tasks are created through the UI, so the API-test
 * cleanup helper does not track them. Delete tasks first (a group's tasks
 * outlive the group), then the groups themselves.
 */
test.afterEach(async ({ request }) => {
    const tasksRes = await request.get(`${SERVER_URL}/api/tasks`);
    const tasks = ((await tasksRes.json()).data ?? []) as Array<{ id: string; text: string }>;
    for (const task of tasks) {
        if (task.text.includes(PREFIX)) {
            await request.delete(`${SERVER_URL}/api/tasks/${task.id}`);
        }
    }
    const groupsRes = await request.get(`${SERVER_URL}/api/someday-groups`);
    const groups = ((await groupsRes.json()).data ?? []) as Array<{ id: string; name: string }>;
    for (const group of groups) {
        if (group.name.includes(PREFIX)) {
            await request.delete(`${SERVER_URL}/api/someday-groups/${group.id}`);
        }
    }
});

/** The someday tag form of a group name, as SomedayPanel derives it. */
function groupTag(name: string): string {
    return `#${name.toLowerCase().replace(/\s+/g, '-')}`;
}

/** Hydrate and open the someday panel, or expand it from the strip. */
async function openPanel(page: Page) {
    await hydrated(page);
    if (!(await page.locator('.someday-panel').isVisible())) {
        await page.getByRole('button', { name: 'Open Someday panel' }).click();
    }
    const panel = page.locator('.someday-panel');
    await expect(panel).toBeVisible();
    return panel;
}

test.describe('Someday panel', () => {
    test('Ctrl+\\ collapses the panel and the strip expands it again', async ({ page }) => {
        const panel = await openPanel(page);

        await page.keyboard.press('Control+\\');
        await expect(panel).toHaveCount(0);

        // The collapsed strip keeps a visible way back in.
        const expand = page.getByRole('button', { name: 'Open Someday panel' });
        await expect(expand).toBeVisible();
        await expand.click();
        await expect(page.locator('.someday-panel')).toBeVisible();
    });

    test('create a group, add a someday task to it, rename the group', async ({
        page,
        request,
    }) => {
        const panel = await openPanel(page);
        const name = uniq(`${PREFIX} Books`);
        const renamed = uniq(`${PREFIX} Reading`);

        // Create the group through the panel's form.
        await panel.getByRole('button', { name: 'Add group' }).click();
        await panel.getByPlaceholder('Group name...').fill(name);
        await panel.getByRole('button', { name: 'Create group' }).click();

        const group = panel.locator('.someday-group', { hasText: name });
        await expect(group).toBeVisible();
        // The section header shows the tag form of the name.
        await expect(group.locator('.section-title')).toContainText(groupTag(name));

        // Add a task into the group via its inline input.
        const text = uniq(`${PREFIX} Read Dune`);
        const input = group.locator('.add-input');
        await input.fill(text);
        await input.press('Enter');
        await expect(group.locator('.task-row', { hasText: text })).toBeVisible();
        // The input resets for the next capture.
        await expect(input).toHaveValue('');

        // Server-side the task is unscheduled and linked to the group.
        const groupsRes = await request.get(`${SERVER_URL}/api/someday-groups`);
        const groupJson = ((await groupsRes.json()).data as Array<{ id: string; name: string }>).find(
            g => g.name === name,
        );
        expect(groupJson).toBeDefined();
        const tasksRes = await request.get(`${SERVER_URL}/api/tasks`);
        const taskJson = ((await tasksRes.json()).data as Array<{
            id: string;
            text: string;
            date: string | null;
            someDayGroupId: string | null;
        }>).find(t => t.text === text);
        expect(taskJson?.date).toBeNull();
        expect(taskJson?.someDayGroupId).toBe(groupJson?.id);

        // Rename the group. While renaming, the header is replaced by the
        // rename input (whose value is not text content), so scope by the
        // panel instead of the group's hasText filter.
        await group.getByRole('button', { name: 'Rename group' }).click();
        await panel.locator('.rename-input').fill(renamed);
        await panel.getByRole('button', { name: 'Save rename' }).click();
        const renamedGroup = panel.locator('.someday-group', { hasText: renamed });
        await expect(renamedGroup.locator('.section-title')).toContainText(groupTag(renamed));
    });

    test('ungrouped someday tasks render below the named groups', async ({ page }) => {
        // date null, no someDayGroupId — the Ungrouped safety section.
        const text = uniq(`${PREFIX} Loose`);
        await createTask(page.request, { text, date: null }, SERVER_URL);
        const panel = await openPanel(page);

        const ungrouped = panel.locator('.someday-group', { hasText: 'Ungrouped' });
        await expect(ungrouped.locator('.task-row', { hasText: text })).toBeVisible();
    });
});
