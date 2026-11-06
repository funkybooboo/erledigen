import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { createTask, uniq } from '../api/helpers';
import { hydrated, SERVER_URL } from './util';

const PREFIX = 'SomedayE2E';

/**
 * Lists, tabs, and someday tasks are created through the UI, so the
 * API-test cleanup helper does not track them. Delete tasks first (a
 * list's tasks outlive the list), then the lists, then the tabs -- the
 * API does not cascade.
 */
test.afterEach(async ({ request }) => {
    const tasksRes = await request.get(`${SERVER_URL}/api/tasks`);
    const tasks = ((await tasksRes.json()).data ?? []) as Array<{ id: string; text: string }>;
    for (const task of tasks) {
        if (task.text.includes(PREFIX)) {
            await request.delete(`${SERVER_URL}/api/tasks/${task.id}`);
        }
    }
    const listsRes = await request.get(`${SERVER_URL}/api/someday-lists`);
    const lists = ((await listsRes.json()).data ?? []) as Array<{ id: string; name: string }>;
    for (const list of lists) {
        if (list.name.includes(PREFIX)) {
            await request.delete(`${SERVER_URL}/api/someday-lists/${list.id}`);
        }
    }
    const tabsRes = await request.get(`${SERVER_URL}/api/someday-tabs`);
    const tabs = ((await tabsRes.json()).data ?? []) as Array<{ id: string; name: string }>;
    for (const tab of tabs) {
        if (tab.name.includes(PREFIX)) {
            await request.delete(`${SERVER_URL}/api/someday-tabs/${tab.id}`);
        }
    }
});

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

    test('create a list, add a someday task to it, rename the list', async ({ page, request }) => {
        const panel = await openPanel(page);
        const name = uniq(`${PREFIX} Books`);
        const renamed = uniq(`${PREFIX} Reading`);

        // Create the list through the panel's form.
        await panel.getByRole('button', { name: 'Add list' }).click();
        await panel.getByPlaceholder('List name...').fill(name);
        await panel.getByRole('button', { name: 'Create list' }).click();

        const list = panel.locator('.someday-group', { hasText: name });
        await expect(list).toBeVisible();
        // The section header shows just the name -- plain lists carry
        // no tag of their own (USE-16).
        await expect(list.locator('.section-title')).toContainText(name);

        // Add a task into the list via its inline input.
        const text = uniq(`${PREFIX} Read Dune`);
        const input = list.locator('.add-input');
        await input.fill(text);
        await input.press('Enter');
        await expect(list.locator('.task-row', { hasText: text })).toBeVisible();
        // The input resets for the next capture.
        await expect(input).toHaveValue('');

        // Server-side the task is unscheduled and parked in the list.
        const listsRes = await request.get(`${SERVER_URL}/api/someday-lists`);
        const listJson = ((await listsRes.json()).data as Array<{ id: string; name: string }>).find(
            l => l.name === name,
        );
        expect(listJson).toBeDefined();
        const tasksRes = await request.get(`${SERVER_URL}/api/tasks`);
        const taskJson = (
            (await tasksRes.json()).data as Array<{
                id: string;
                text: string;
                date: string | null;
                somedayListId: string | null;
            }>
        ).find(t => t.text === text);
        expect(taskJson?.date).toBeNull();
        expect(taskJson?.somedayListId).toBe(listJson?.id);

        // Rename the list. While renaming, the header is replaced by the
        // rename input (whose value is not text content), so scope by the
        // panel instead of the list's hasText filter.
        await list.getByRole('button', { name: 'Rename list' }).click();
        await panel.locator('.rename-input').fill(renamed);
        await panel.getByRole('button', { name: 'Save rename' }).click();
        const renamedList = panel.locator('.someday-group', { hasText: renamed });
        await expect(renamedList.locator('.section-title')).toContainText(renamed);
    });

    test('a second tab holds its own lists; the default tab cannot be deleted', async ({
        page,
        request,
    }) => {
        const panel = await openPanel(page);
        const tabName = uniq(`${PREFIX} Projects`);
        const listName = uniq(`${PREFIX} House`);

        // Add a tab through the strip.
        await panel.getByRole('button', { name: 'Add tab' }).click();
        await panel.getByPlaceholder('Tab name...').fill(tabName);
        await panel.getByRole('button', { name: 'Create tab' }).click();

        // The new tab becomes active and its label shows (with more than
        // one tab, labels render).
        const tabBtn = panel.locator('.tab-btn', { hasText: tabName });
        await expect(tabBtn).toBeVisible();
        await expect(tabBtn).toHaveAttribute('aria-current', 'page');

        // Add a list inside the new tab.
        await panel.getByRole('button', { name: 'Add list' }).click();
        await panel.getByPlaceholder('List name...').fill(listName);
        await panel.getByRole('button', { name: 'Create list' }).click();
        const list = panel.locator('.someday-group', { hasText: listName });
        await expect(list).toBeVisible();

        // Add a task to the tab's list.
        const text = uniq(`${PREFIX} Fix stairs`);
        const input = list.locator('.add-input');
        await input.fill(text);
        await input.press('Enter');
        await expect(list.locator('.task-row', { hasText: text })).toBeVisible();

        // Server-side the list carries the tab's id.
        const listsRes = await request.get(`${SERVER_URL}/api/someday-lists`);
        const tabsRes = await request.get(`${SERVER_URL}/api/someday-tabs`);
        const tabJson = ((await tabsRes.json()).data as Array<{ id: string; name: string }>).find(
            t => t.name === tabName,
        );
        const listJson = (
            (await listsRes.json()).data as Array<{ id: string; name: string; tabId: string }>
        ).find(l => l.name === listName);
        expect(listJson?.tabId).toBe(tabJson?.id);

        // Switching back to the default tab hides the other tab's list.
        await panel.locator('.tab-btn', { hasText: 'Someday' }).first().click();
        await expect(panel.locator('.someday-group', { hasText: listName })).toHaveCount(0);
        await panel.locator('.tab-btn', { hasText: tabName }).click();
        await expect(panel.locator('.someday-group', { hasText: listName })).toBeVisible();

        // The default tab has no delete affordance; the new tab does.
        await panel.locator('.tab-btn', { hasText: tabName }).click();
        await expect(panel.getByRole('button', { name: 'Delete tab' })).toBeVisible();
        await panel.locator('.tab-btn', { hasText: 'Someday' }).first().click();
        await expect(panel.getByRole('button', { name: 'Delete tab' })).toHaveCount(0);
    });

    test('unlisted someday tasks render in the default tab below the lists', async ({ page }) => {
        // date null, no somedayListId -- the Unlisted safety section.
        const text = uniq(`${PREFIX} Loose`);
        await createTask(page.request, { text, date: null }, SERVER_URL);
        const panel = await openPanel(page);

        const unlisted = panel.locator('.someday-group', { hasText: 'Unlisted' });
        await expect(unlisted.locator('.task-row', { hasText: text })).toBeVisible();
    });
});
