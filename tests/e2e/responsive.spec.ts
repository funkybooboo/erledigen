import { expect, type Locator, test } from '@playwright/test';
import { hydrated, modal } from './util';

/**
 * Responsive layout (v0.6.0): below 768px the app goes mobile --
 * modals dock as bottom sheets, the Someday panel floats as a right
 * sheet over the full-width day list, the month minimap hides. At
 * tablet widths the panel still squeezes the layout inline.
 */

const MOBILE = { width: 375, height: 667 } as const;
const TABLET = { width: 820, height: 1024 } as const;

/** Close the Someday panel if it is open, so tests start from a known
 *  state (the panel is open by default on a fresh server). */
async function collapseSomeday(page: import('@playwright/test').Page) {
    const panel = page.locator('.someday-panel');
    if (await panel.isVisible()) {
        await panel.getByRole('button', { name: 'Collapse Someday panel' }).click();
    }
    await expect(page.locator('.someday-panel')).toHaveCount(0);
}

/** A locator's bounding box, with the null case turned into a test
 *  failure (null means the element is not rendered). Every measurement
 *  below needs real geometry. */
type Box = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;

async function measuredBox(locator: Locator): Promise<Box> {
    const box = await locator.boundingBox();
    if (box === null) throw new Error('element has no bounding box');
    return box;
}

test.describe('responsive layout', () => {
    test('mobile: day list fills the width and the minimap hides', async ({ page }) => {
        await page.setViewportSize(MOBILE);
        await hydrated(page);
        await collapseSomeday(page);

        // The minimap gave its 62px back (display:none keeps the element
        // in the DOM, so assert hidden rather than absent).
        await expect(page.locator('.minimap')).toBeHidden();
        const dayList = page.locator('#main-content');
        const box = await measuredBox(dayList);
        // 375 viewport - 64px icon rail - 24px Someday strip = 287px day
        // list: full width minus the two permanent affordances.
        expect(box.width).toBeGreaterThan(280);
        expect(box.x).toBeGreaterThan(50); // behind the rail, not hidden

        // The bottom bar stays pinned to the viewport bottom.
        const barBox = await measuredBox(page.locator('footer.bottom-bar'));
        expect(barBox.y + barBox.height).toBeGreaterThan(MOBILE.height - 41);
    });

    test('mobile: a modal docks as a bottom sheet', async ({ page }) => {
        await page.setViewportSize(MOBILE);
        await hydrated(page);
        await collapseSomeday(page);

        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        const sheet = modal(page, 'Settings');
        await expect(sheet).toBeVisible();

        const box = await measuredBox(sheet);
        // Full width...
        expect(box.x).toBeLessThanOrEqual(1);
        expect(box.width).toBeGreaterThanOrEqual(MOBILE.width - 1);
        // ...and anchored to the bottom edge (docked, not centered).
        expect(box.y + box.height).toBeGreaterThan(MOBILE.height - 2);
        // Capped so the app behind it stays visible.
        expect(box.height).toBeLessThan(MOBILE.height);
    });

    test('mobile: Someday opens as an overlay that leaves the day list full width', async ({
        page,
    }) => {
        await page.setViewportSize(MOBILE);
        await hydrated(page);
        await collapseSomeday(page);

        const dayList = page.locator('#main-content');
        const widthClosed = (await measuredBox(dayList)).width;

        await page.getByRole('button', { name: 'Open Someday panel' }).click();
        const panel = page.locator('.someday-panel');
        await expect(panel).toBeVisible();

        // The panel floats on the right edge...
        const panelBox = await measuredBox(panel);
        expect(panelBox.width).toBeGreaterThan(100);
        expect(panelBox.x + panelBox.width).toBeGreaterThan(MOBILE.width - 2);
        // ...over the day list, which keeps its full width (no squeeze).
        const widthOpen = (await measuredBox(dayList)).width;
        expect(widthOpen).toBeGreaterThan(widthClosed - 5);

        // The header collapse button closes the overlay.
        await panel.getByRole('button', { name: 'Collapse Someday panel' }).click();
        await expect(panel).toHaveCount(0);
        expect((await measuredBox(dayList)).width).toBeGreaterThan(widthClosed - 5);
    });

    test('tablet: the Someday panel still squeezes the layout inline', async ({ page }) => {
        await page.setViewportSize(TABLET);
        await hydrated(page);
        await collapseSomeday(page);

        const dayList = page.locator('#main-content');
        const widthClosed = (await measuredBox(dayList)).width;

        await page.getByRole('button', { name: 'Open Someday panel' }).click();
        await expect(page.locator('.someday-panel')).toBeVisible();

        // Inline panel: the day list gives up its room.
        const widthOpen = (await measuredBox(dayList)).width;
        expect(widthOpen).toBeLessThan(widthClosed - 100);

        // And the minimap still renders at tablet width.
        await expect(page.locator('.minimap')).toBeVisible();
    });
});
