import { expect, test } from '@playwright/test';
import { cleanup, createTask, uniq } from '../api-tests/helpers';
import { hydrated, SERVER_URL, todayISO } from './util';

test.afterEach(async ({ request }) => {
    await cleanup(request, SERVER_URL);
});

/**
 * The `use:tooltip` action (lib/tooltip.ts): hovering an action shows its
 * label plus the keybinding chips rendered from the shared registry
 * (lib/keybindings.ts). Tooltips appear after a short delay, so every
 * visibility assertion relies on Playwright's auto-waiting.
 */
test.describe('hover tooltips', () => {
    test('rail buttons show their action label and keybinding chips', async ({ page }) => {
        await hydrated(page);

        await page.getByRole('button', { name: 'Trash', exact: true }).hover();
        const tip = page.locator('.ui-tooltip');
        await expect(tip).toBeVisible();
        await expect(tip).toContainText('Trash');
        // The "g x" chord renders as one kbd chip per keystroke.
        await expect(tip.locator('kbd')).toHaveText(['g', 'x']);

        // Moving away hides it again.
        await page.locator('.day-list').first().hover();
        await expect(tip).toHaveCount(0);
    });

    test('task-row checkbox shows the complete binding', async ({ page }) => {
        const text = uniq('TipComplete');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);

        const checkbox = page
            .locator('.task-row', { hasText: text })
            .first()
            .getByRole('button', { name: /Mark complete/ });
        await checkbox.hover();

        const tip = page.locator('.ui-tooltip');
        await expect(tip).toBeVisible();
        await expect(tip).toContainText('Mark complete');
        await expect(tip.locator('kbd')).toHaveText(['Space']);
    });

    test('a modifier binding renders the platform modifier as a chip', async ({ page }) => {
        await hydrated(page);

        // Search's binding is "{mod}+K" / "" — the {mod} token expands to
        // "Ctrl+K" (one chip, plus kept) on Linux/Chromium.
        await page.getByRole('button', { name: 'Search', exact: true }).hover();
        const tip = page.locator('.ui-tooltip');
        await expect(tip).toBeVisible();
        await expect(tip.locator('kbd')).toHaveText(['Ctrl+K', '/']);
    });

    test('label-only tooltips render without keybinding chips', async ({ page }) => {
        await hydrated(page);

        // The Someday panel's "Add group" button documents no shortcut, so
        // its tooltip must show the label and no kbd chips.
        await page.getByRole('button', { name: 'Add group' }).hover();
        const tip = page.locator('.ui-tooltip');
        await expect(tip).toBeVisible();
        await expect(tip).toContainText('Add group');
        await expect(tip.locator('kbd')).toHaveCount(0);
    });
});
