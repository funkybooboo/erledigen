import { expect, test } from '@playwright/test';
import { cleanup, createHoliday, uniq } from '../api/helpers';
import { dayISO, hydrated, modal, SERVER_URL } from './util';

test.afterEach(async ({ request }) => {
    await cleanup(request, SERVER_URL);
});

/** The day section element for a date key. */
function daySection(page: import('@playwright/test').Page, date: string) {
    return page.locator(`#day-${date}`);
}

test.describe('holidays', () => {
    test('a holiday created through Settings shows a banner on its day', async ({ page }) => {
        await hydrated(page);

        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        const settings = modal(page, 'Settings');
        await expect(settings).toBeVisible();

        const name = uniq('Banner Day');
        const date = dayISO(15);
        await settings.getByLabel('Holiday name').fill(name);
        await settings.getByLabel('Holiday date').fill(date);
        await settings.getByRole('button', { name: 'Add', exact: true }).click();

        // The new holiday renders in the Settings list immediately.
        await expect(settings.locator('.holiday-row', { hasText: name })).toBeVisible();

        // Navigate to the date through the URL-free path: the day list
        // renders every date, so scrolling to the section works directly.
        await page.keyboard.press('Escape');
        const section = daySection(page, date);
        await section.scrollIntoViewIfNeeded();
        await expect(section.locator('.holiday-banner')).toHaveText(name);
    });

    test('a holiday created in another tab appears live (WS broadcast)', async ({ page }) => {
        const date = dayISO(10);
        await hydrated(page);
        const section = daySection(page, date);
        await section.scrollIntoViewIfNeeded();
        await expect(section.locator('.holiday-banner')).toHaveCount(0);

        // Seeded through the API AFTER hydration: only the holiday:created
        // WebSocket broadcast can make the banner appear without a reload.
        const name = uniq('Live Banner');
        await createHoliday(page.request, { name, date }, SERVER_URL);

        await expect(section.locator('.holiday-banner')).toHaveText(name);
    });

    test('deleting a holiday from Settings removes its banner', async ({ page }) => {
        const name = uniq('Deleted Banner');
        const date = dayISO(20);
        await createHoliday(page.request, { name, date }, SERVER_URL);

        await hydrated(page);
        const section = daySection(page, date);
        await section.scrollIntoViewIfNeeded();
        await expect(section.locator('.holiday-banner')).toHaveText(name);

        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        const settings = modal(page, 'Settings');
        const row = settings.locator('.holiday-row', { hasText: name });
        await row.getByRole('button', { name: `Delete ${name}` }).click();

        await page.keyboard.press('Escape');
        await expect(section.locator('.holiday-banner')).toHaveCount(0);
    });
});
