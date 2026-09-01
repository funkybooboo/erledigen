import { expect, test } from '@playwright/test';
import { hydrated, modal, todayISO } from './util';

/** The 15th of next month as YYYY-MM-DD (browser-local, like dateProvider). */
function nextMonthDayISO(day: number): string {
    const d = new Date();
    d.setDate(1); // anchor to the 1st so +1 month never overflows
    d.setMonth(d.getMonth() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

test.describe('Calendar modal', () => {
    test('month navigation moves the grid back and forth', async ({ page }) => {
        await hydrated(page);
        await page.getByRole('button', { name: 'Calendar', exact: true }).click();
        const cal = modal(page, 'Calendar');
        await expect(cal).toBeVisible();

        const monthName = cal.locator('.month-name');
        const original = await monthName.textContent();
        expect(original).toBeTruthy();

        await cal.getByRole('button', { name: 'Next month' }).click();
        await expect(monthName).not.toHaveText(original ?? '');

        // Going back returns to the original month (the grid, not the day
        // list, is what these buttons move).
        await cal.getByRole('button', { name: 'Previous month' }).click();
        await expect(monthName).toHaveText(original ?? '');
    });

    test('the Today button selects today and closes the modal', async ({ page }) => {
        await hydrated(page);
        await page.getByRole('button', { name: 'Calendar', exact: true }).click();
        const cal = modal(page, 'Calendar');
        await expect(cal).toBeVisible();

        // Browse away first so Today has somewhere to come back from.
        await cal.getByRole('button', { name: 'Next month' }).click();
        await cal.getByRole('button', { name: 'Today', exact: true }).click();

        // Selecting a date (today included) closes the modal and scrolls
        // the day list to the chosen date.
        await expect(cal).toBeHidden();
        await expect(page.locator(`section#day-${todayISO()}`)).toBeVisible();
    });

    test('selecting a future date closes the modal and scrolls the day list to it', async ({
        page,
    }) => {
        await hydrated(page);
        await page.getByRole('button', { name: 'Calendar', exact: true }).click();
        const cal = modal(page, 'Calendar');
        await expect(cal).toBeVisible();

        // Pick the 15th of next month — far enough out that the day list
        // must extend its render window to reach it.
        await cal.getByRole('button', { name: 'Next month' }).click();
        const target = nextMonthDayISO(15);
        await cal.getByRole('button', { name: '15', exact: true }).click();

        // The modal closes and the chosen day section is on screen. Pin the
        // section element (the header uses day-<date>-header).
        await expect(cal).toBeHidden();
        const section = page.locator(`section#day-${target}`);
        await expect(section).toBeVisible();
        const box = await section.boundingBox();
        const viewport = page.viewportSize();
        expect(box).not.toBeNull();
        expect(box?.y).toBeGreaterThanOrEqual(0);
        expect(viewport && box ? box.y + box.height <= viewport.height : false).toBe(true);
    });
});
