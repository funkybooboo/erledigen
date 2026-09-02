import { expect, test } from '@playwright/test';
import { createTask, uniq } from '../api-tests/helpers';
import { hydrated, SERVER_URL, todayISO } from './util';

/**
 * The undo history in notificationStore outlives the toast: Ctrl/Cmd+Z
 * pops the most recent undoable action even after its notification has
 * auto-dismissed. (tasks.spec.ts covers the immediate Ctrl+Z and the
 * toast-button paths.)
 */
test.describe('undo history', () => {
    test('Ctrl+Z still undoes after the toast has expired', async ({ page }) => {
        const text = uniq('UndoExpire');
        const task = await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);

        const row = page.locator('.task-row', { hasText: text }).first();
        await row.getByRole('button', { name: 'Delete task' }).click();
        const notif = page.locator('.notification', { hasText: 'Task deleted' });
        await expect(notif).toBeVisible();
        await expect(row).toHaveCount(0);

        // Let the toast expire on its own (4s + leave animation) -- the
        // undo binding must survive it.
        await expect(page.locator('.notification')).toHaveCount(0);

        await page.keyboard.press('Control+z');
        await expect(page.locator('.task-row', { hasText: text })).toBeVisible();
        const res = await page.request.get(`${SERVER_URL}/api/tasks/${task.id}`);
        expect(res.status()).toBe(200);
        expect((await res.json()).data.deletedAt).toBeNull();
    });
});