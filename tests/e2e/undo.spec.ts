import { expect, test } from '@playwright/test';
import { cleanup, createTask, uniq } from '../api/helpers';
import { hydrated, SERVER_URL, todayISO } from './util';

test.afterEach(async ({ request }) => {
    // The undo tests leave their tasks RESTORED (active in today's
    // section) -- without this hook they leak into every later run on the
    // same server and break the day-list adjacency assumptions of the
    // keyboard specs (CI hides this because undo.spec runs last on a
    // fresh server; targeted local runs do not).
    await cleanup(request, SERVER_URL);
});

/**
 * The undo history in notificationStore outlives the toast: Ctrl/Cmd+Z
 * pops the most recent undoable action even after its notification has
 * auto-dismissed. (tasks.spec.ts covers the immediate Ctrl+Z and the
 * toast-button paths.) Ctrl/Cmd+Shift+Z replays what undo reverted.
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

    test('Ctrl+Shift+Z redoes a delete after a keyboard undo', async ({ page }) => {
        const text = uniq('RedoDelete');
        const task = await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);

        const row = page.locator('.task-row', { hasText: text }).first();
        await row.getByRole('button', { name: 'Delete task' }).click();
        // The row disappearing is OPTIMISTIC (same tick as the click), but
        // the undo entry is only pushed once the DELETE round-trip lands.
        // Waiting for the toast synchronizes on the undo entry existing --
        // pressing Ctrl+Z off the optimistic removal alone races an empty
        // undo history under full-suite load and silently no-ops.
        await expect(page.locator('.notification', { hasText: 'Task deleted' })).toBeVisible();
        await expect(page.locator('.task-row', { hasText: text })).toHaveCount(0);

        // Undo restores, redo re-deletes.
        await page.keyboard.press('Control+z');
        await expect(page.locator('.task-row', { hasText: text })).toBeVisible();
        await page.keyboard.press('Control+Shift+Z');
        await expect(page.locator('.task-row', { hasText: text })).toHaveCount(0);
        // A trashed task is hidden from the plain GET (findById ignores
        // soft-deleted rows) -- the strongest proof of the re-delete.
        const res = await page.request.get(`${SERVER_URL}/api/tasks/${task.id}`);
        expect(res.status()).toBe(404);
    });

    test('Ctrl+Shift+Z also redoes after the Undo toast button was used', async ({ page }) => {
        const text = uniq('RedoToast');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);

        const row = page.locator('.task-row', { hasText: text }).first();
        await row.getByRole('button', { name: 'Delete task' }).click();
        await expect(page.locator('.task-row', { hasText: text })).toHaveCount(0);

        // Undo through the toast button (a different code path than the
        // keyboard binding) must stash the redo entry too.
        await page.getByRole('button', { name: 'Undo', exact: true }).click();
        await expect(page.locator('.task-row', { hasText: text })).toBeVisible();
        await page.keyboard.press('Control+Shift+Z');
        await expect(page.locator('.task-row', { hasText: text })).toHaveCount(0);
    });
});
