/**
 * Screen reader support (USE-10): the behaviors assistive tech relies
 * on, verified in the browser. The human half (NVDA + VoiceOver passes
 * over the core flows) is the manual protocol in
 * docs/build/standards/accessibility.md -- automation covers only the
 * machine-checkable share.
 */
import { expect, test } from '@playwright/test';
import { cleanup, createTask, uniq } from '../api/helpers';
import { hydrated, modal, SERVER_URL, todayISO } from './util';

test.afterEach(async ({ request }) => {
    await cleanup(request, SERVER_URL);
});

test.describe('focus management', () => {
    test('the skip link is the first Tab stop and jumps to the content', async ({ page }) => {
        await hydrated(page);
        await page.keyboard.press('Tab');
        const skip = page.getByRole('link', { name: 'Skip to content' });
        await expect(skip).toBeFocused();
        await page.keyboard.press('Enter');
        // The fragment target becomes the sequential focus point.
        await expect(page.locator('main#main-content')).toBeFocused();
    });

    test('Tab never escapes an open dialog (focus trap)', async ({ page }) => {
        await hydrated(page);
        await page.getByRole('button', { name: 'Help', exact: true }).click();
        await expect(modal(page, 'Keyboard Shortcuts')).toBeVisible();

        // Cycle well past the last control inside the dialog: focus must
        // wrap within it, never landing on the page behind.
        for (let i = 0; i < 25; i++) {
            await page.keyboard.press('Tab');
            const inside = await page.evaluate(
                () => document.activeElement?.closest('.modal-backdrop') !== null,
            );
            expect(inside, `focus escaped the dialog at Tab ${i + 1}`).toBe(true);
        }
    });

    test('Esc closes the dialog and returns focus to its trigger', async ({ page }) => {
        await hydrated(page);
        const trigger = page.getByRole('button', { name: 'Theme', exact: true });
        await trigger.click();
        await expect(modal(page, 'Theme')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(modal(page, 'Theme')).toBeHidden();
        // The trigger is focused again, so the next Tab continues from
        // where the user left the page.
        await expect(trigger).toBeFocused();
    });
});

test.describe('announcements reach the live region', () => {
    test('deleting a task announces through the role=status region', async ({ page }) => {
        const text = uniq('SrDelete');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);

        const row = page.locator('.task-row', { hasText: text });
        await expect(row).toBeVisible();
        await row.getByRole('button', { name: 'Delete task' }).click();

        // The notification container is the aria-live region: the Undo
        // toast lands inside it, so screen readers hear the delete.
        await expect(page.getByRole('status').filter({ hasText: 'Task deleted' })).toBeVisible();
        await expect(page.getByRole('status').getByRole('button', { name: 'Undo' })).toBeVisible();
    });

    test('completing a task updates its announced state', async ({ page }) => {
        const text = uniq('SrComplete');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);

        const row = page.locator('.task-row', { hasText: text });
        await row.getByRole('button', { name: 'Mark complete' }).click();
        // The pressed state flips and the label reads "Mark incomplete" --
        // the screen reader's re-queried state reads correctly.
        const uncomplete = row.getByRole('button', { name: 'Mark incomplete' });
        await expect(uncomplete).toHaveAttribute('aria-pressed', 'true');
        // And the row's own accessible name now says completed.
        await expect(row).toHaveAttribute('aria-label', `${text}, completed`);
    });
});
