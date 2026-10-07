import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { cleanup, createGroup, createTask, uniq } from '../api-tests/helpers';
import { dayISO, hydrated, SERVER_URL, todayISO } from './util';

test.afterEach(async ({ request }) => {
    await cleanup(request, SERVER_URL);
});

/** The row for a seeded task text (rows are unique per test thanks to uniq). */
function row(page: Page, text: string): Locator {
    return page.locator('.task-row', { hasText: text }).first();
}

/** The grip handle on a row -- the only element that initiates a drag. */
function grip(page: Page, text: string): Locator {
    return row(page, text).locator('.drag-grip');
}

/** Today's section (the drop target for cross-zone drags). */
function todaySection(page: Page): Locator {
    return page.locator('.day-section.today');
}

/** Hydrate and open the someday panel (expand from the strip if needed). */
async function openPanel(page: Page): Promise<Locator> {
    await hydrated(page);
    if (!(await page.locator('.someday-panel').isVisible())) {
        await page.getByRole('button', { name: 'Open Someday panel' }).click();
    }
    const panel = page.locator('.someday-panel');
    await expect(panel).toBeVisible();
    return panel;
}

/** Row text order inside a container, in DOM order. */
async function rowTexts(container: Locator): Promise<string[]> {
    const rows = container.locator('.task-row');
    const texts: string[] = [];
    for (let i = 0; i < (await rows.count()); i++) {
        texts.push((await rows.nth(i).locator('.task-text').innerText()).trim());
    }
    return texts;
}

test.describe('drag and drop', () => {
    test('reorder within a day: dragging the last row before the first', async ({ page }) => {
        const a = uniq('DragA');
        const b = uniq('DragB');
        const c = uniq('DragC');
        await createTask(page.request, { text: a, date: todayISO() }, SERVER_URL);
        await page.waitForTimeout(10);
        await createTask(page.request, { text: b, date: todayISO() }, SERVER_URL);
        await page.waitForTimeout(10);
        await createTask(page.request, { text: c, date: todayISO() }, SERVER_URL);
        await hydrated(page);

        const section = todaySection(page);
        await expect(section).toBeVisible();
        // Readiness: a seeded row must render before reading DOM order
        // (the store fetch can still be in flight right after hydration).
        await expect(section.locator('.task-row', { hasText: a })).toBeVisible();
        let texts = await rowTexts(section);
        expect(texts.indexOf(a)).toBeLessThan(texts.indexOf(b));
        expect(texts.indexOf(b)).toBeLessThan(texts.indexOf(c));

        // Drag C's grip onto A's row, upper half = "insert before A".
        await grip(page, c).dragTo(row(page, a), { targetPosition: { x: 100, y: 4 } });

        // DOM reflects the optimistic reorder immediately, and the server
        // agrees: C's position undercuts A's.
        texts = await rowTexts(section);
        expect(texts.indexOf(c)).toBeLessThan(texts.indexOf(a));
        // Let the position PATCHes land, then compare server-side positions.
        await page.waitForTimeout(300);
        const res = await page.request.get(`${SERVER_URL}/api/tasks?date=${todayISO()}`);
        const body = (await res.json()) as {
            data: Array<{ text: string; position: number | null }>;
        };
        const byText = new Map(body.data.map(t => [t.text, t]));
        const posC = byText.get(c)?.position;
        const posA = byText.get(a)?.position;
        expect(posC).not.toBeNull();
        expect(posA).not.toBeNull();
        expect(posC as number).toBeLessThan(posA as number);

        // The order survives a reload (positions persisted, not just local).
        await page.reload();
        await page.locator('.app-shell[data-hydrated="true"]').waitFor({ timeout: 15_000 });
        // Positive readiness wait: the store refetch races hydration, so
        // wait for a seeded row before reading order back.
        await expect(todaySection(page).locator('.task-row', { hasText: b })).toBeVisible();
        texts = await rowTexts(todaySection(page));
        expect(texts.indexOf(c)).toBeLessThan(texts.indexOf(a));
    });

    test('drag a task to another day section', async ({ page }) => {
        const text = uniq('DragTomorrow');
        const task = await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);

        const tomorrow = dayISO(1);
        const targetSection = page.locator(`#day-${tomorrow}`);
        await expect(targetSection).toBeVisible();

        await grip(page, text).dragTo(targetSection, { targetPosition: { x: 200, y: 30 } });

        // The row left today's section...
        await expect(todaySection(page).locator('.task-row', { hasText: text })).toHaveCount(0);
        // ...and the server moved it to tomorrow (position rewritten to 0).
        const res = await page.request.get(`${SERVER_URL}/api/tasks/${task.id}`);
        const body = (await res.json()) as {
            data: { date: string | null; position: number | null };
        };
        expect(body.data.date).toBe(tomorrow);
        expect(body.data.position).toBe(0);
    });

    test('drag a task into a someday group', async ({ page }) => {
        const text = uniq('DragToSomeday');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        const group = await createGroup(
            page.request,
            { name: uniq('DragGroup'), tag: `drag-${Date.now()}`, position: 0 },
            SERVER_URL,
        );
        await openPanel(page);

        const groupEl = page.locator('.someday-group', { hasText: group['name'] });
        await expect(groupEl).toBeVisible();
        await grip(page, text).dragTo(groupEl, { targetPosition: { x: 100, y: 20 } });

        // Date cleared + group assigned on the server.
        const res = await page.request.get(`${SERVER_URL}/api/tasks?someday=true`);
        const body = (await res.json()) as {
            data: Array<{ text: string; someDayGroupId: string | null }>;
        };
        const moved = body.data.find(t => t.text === text);
        expect(moved).toBeDefined();
        expect(moved?.someDayGroupId).toBe(group.id);

        // And the row renders inside the group in the panel.
        await expect(groupEl.locator('.task-row', { hasText: text })).toBeVisible();
        await expect(todaySection(page).locator('.task-row', { hasText: text })).toHaveCount(0);
    });

    test('drag a someday task onto a day section to schedule it', async ({ page }) => {
        const text = uniq('DragFromSomeday');
        const task = await createTask(page.request, { text }, SERVER_URL);
        await openPanel(page);

        await expect(page.locator('.someday-panel .task-row', { hasText: text })).toBeVisible();

        await grip(page, text).dragTo(todaySection(page), { targetPosition: { x: 200, y: 30 } });

        const res = await page.request.get(`${SERVER_URL}/api/tasks/${task.id}`);
        const body = (await res.json()) as { data: { date: string | null } };
        expect(body.data.date).toBe(todayISO());
        await expect(todaySection(page).locator('.task-row', { hasText: text })).toBeVisible();
        await expect(page.locator('.someday-panel .task-row', { hasText: text })).toHaveCount(0);
    });
});
