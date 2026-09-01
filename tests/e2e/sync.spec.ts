import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { cleanup, createTask, uniq } from '../api-tests/helpers';
import { hydrated, SERVER_URL, todayInput, todayISO } from './util';

/** Texts of tasks created through the UI in this spec (serial worker). */
const uiCreatedTexts: string[] = [];

/** Create a task through tab A's inline input and record it for cleanup. */
async function createViaUi(page: Page, text: string) {
    uiCreatedTexts.push(text);
    const input = await todayInput(page);
    await input.fill(text);
    await input.press('Enter');
}

test.afterEach(async ({ request }) => {
    await cleanup(request, SERVER_URL);
    // Tasks created through the UI are not tracked by the cleanup helper;
    // remove them by exact text so later tests start with a clean day list.
    if (uiCreatedTexts.length > 0) {
        const res = await request.get(`${SERVER_URL}/api/tasks`);
        const tasks = ((await res.json()).data ?? []) as Array<{ id: string; text: string }>;
        for (const task of tasks) {
            if (uiCreatedTexts.includes(task.text)) {
                await request.delete(`${SERVER_URL}/api/tasks/${task.id}`);
            }
        }
    }
});

/**
 * Live WebSocket sync between two open tabs. Each mutation must broadcast to
 * every other connected client — and must never double-render in the
 * originating tab (the optimistic add plus an unfiltered echo used to
 * duplicate the task and crash the keyed each-block).
 */
test.describe('live sync between open tabs (WebSocket)', () => {
    test('a task created in one tab appears in the other without a reload', async ({
        page,
        context,
    }) => {
        const tabB = await context.newPage();
        await hydrated(page);
        await hydrated(tabB);

        const text = uniq('SyncCreate');
        await createViaUi(page, text);

        // The originating tab renders it exactly once (no self-echo dupes).
        await expect(page.locator('.task-row', { hasText: text })).toHaveCount(1);

        // The second tab renders it live — no reload, WS broadcast only.
        await expect(tabB.locator('.day-section.today').getByText(text)).toBeVisible();
        await expect(tabB.locator('.task-row', { hasText: text })).toHaveCount(1);
    });

    test('completing a task in one tab flips it in the other', async ({ page, context }) => {
        const text = uniq('SyncComplete');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        const tabB = await context.newPage();
        await hydrated(page);
        await hydrated(tabB);

        const rowB = tabB.locator('.task-row', { hasText: text }).first();
        await expect(rowB).toBeVisible();

        await page
            .locator('.task-row', { hasText: text })
            .first()
            .getByRole('button', { name: /Mark complete/ })
            .click();

        await expect(rowB).toHaveClass(/completed/);
        await expect(rowB.getByRole('button', { name: /Mark incomplete/ })).toBeVisible();
    });

    test('deleting a task in one tab removes it from the other', async ({ page, context }) => {
        const text = uniq('SyncDelete');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        const tabB = await context.newPage();
        await hydrated(page);
        await hydrated(tabB);

        await expect(tabB.locator('.task-row', { hasText: text })).toHaveCount(1);

        await page
            .locator('.task-row', { hasText: text })
            .first()
            .getByRole('button', { name: 'Delete task' })
            .click();

        await expect(tabB.locator('.task-row', { hasText: text })).toHaveCount(0);
    });
});
