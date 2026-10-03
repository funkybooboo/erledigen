import { expect, test } from '@playwright/test';
import { cleanup, createProject, createTask, del, patch, uniq } from '../api-tests/helpers';
import { dayISO, hydrated, modal, SERVER_URL, todayISO } from './util';

test.afterEach(async ({ request }) => {
    await cleanup(request, SERVER_URL);
});

test.describe('Settings modal', () => {
    test('changing theme applies it to the document and persists to the server', async ({ page }) => {
        // Capture original to restore.
        const before = await page.request.get(`${SERVER_URL}/api/preferences`);
        const origTheme = (await before.json()).data.theme;

        await hydrated(page);
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        const settings = modal(page, 'Settings');
        await expect(settings).toBeVisible();
        await settings.locator('#theme-select').selectOption('dark');
        // Theme selection drives an immediate PATCH and the layout's $effect sets
        // document data-theme, so assert the user-visible outcome first.
        await expect
            .poll(async () => page.evaluate(() => document.documentElement.getAttribute('data-theme')))
            .toBe('dark');
        // And the server persists it.
        await expect
            .poll(async () => {
                const r = await page.request.get(`${SERVER_URL}/api/preferences`);
                return (await r.json()).data.theme;
            })
            .toBe('dark');

        // Restore theme - the modal also leaves it dirty, so close and reset.
        await page.request.patch(`${SERVER_URL}/api/preferences`, { data: { theme: origTheme } });
    });

    test('clearing the timezone input resets it', async ({ page }) => {
        await hydrated(page);
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        const settings = modal(page, 'Settings');
        await expect(settings.locator('#tz-input')).toBeVisible();
        await expect(settings.locator('#time-format-select')).toBeVisible();
    });

    test('exporting downloads the JSON backup with a dated filename', async ({ page }) => {
        await hydrated(page);
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        const settings = modal(page, 'Settings');

        const downloadPromise = page.waitForEvent('download');
        await settings.getByRole('button', { name: 'Download JSON backup' }).click();
        const download = await downloadPromise;

        // The blob download carries the server-side naming convention.
        expect(download.suggestedFilename()).toMatch(
            /^erledigen-export-\d{4}-\d{2}-\d{2}\.json$/,
        );
    });
});

test.describe('Search modal', () => {
    // Commands that persist preference state must never leak it into other
    // spec files -- a stale tag filter hides tasks in every later test.
    test.afterEach(async ({ request }) => {
        await patch(
            request,
            '/api/preferences',
            {
                activeFilters: {
                    tags: [],
                    showCompleted: true,
                    sortMode: 'manual',
                    dateFrom: null,
                    dateTo: null,
                },
            },
            SERVER_URL,
        ).catch(() => {});
    });

    test('searching filters tasks by text and shows results', async ({ page }) => {
        const needle = uniq('SearchNeedle');
        await createTask(page.request, { text: needle, date: todayISO() }, SERVER_URL);
        await createTask(page.request, { text: uniq('OtherTask'), date: todayISO() }, SERVER_URL);
        await hydrated(page);
        await page.keyboard.press('/');
        const modalEl = modal(page, 'Search');
        await expect(modalEl).toBeVisible();
        await modalEl.getByLabel('Search tasks').fill(needle);
        await expect(modalEl.locator('.result-item', { hasText: needle })).toBeVisible();
        // The unrelated task does not appear in the filtered result list.
        await expect(modalEl.locator('.result-item')).toHaveCount(1);
    });

    test('empty query shows the hint, no results', async ({ page }) => {
        await hydrated(page);
        await page.keyboard.press('/');
        const modalEl = modal(page, 'Search');
        await expect(modalEl).toBeVisible();
        await expect(modalEl.locator('.hint')).toBeVisible();
        await expect(modalEl.locator('.result-item')).toHaveCount(0);
    });

    test('"/" alone lists commands', async ({ page }) => {
        await hydrated(page);
        await page.keyboard.press('/');
        const modalEl = modal(page, 'Search');
        await expect(modalEl).toBeVisible();
        await modalEl.getByLabel('Search tasks').fill('/');
        // The full registry is listed, /add first.
        await expect(modalEl.locator('.command-name').first()).toHaveText('/add');
        await expect(modalEl.locator('.command-name').filter({ hasText: '/go' })).toHaveCount(1);
    });

    test('"/add <text>" creates a task for today', async ({ page }) => {
        const text = uniq('PaletteAdd');
        await hydrated(page);
        await page.keyboard.press('/');
        const modalEl = modal(page, 'Search');
        await expect(modalEl).toBeVisible();
        await modalEl.getByLabel('Search tasks').fill(`/add ${text}`);
        await modalEl.getByLabel('Search tasks').press('Enter');

        await expect(modalEl).toBeHidden();
        await expect(page.getByText('Task added to today')).toBeVisible({ timeout: 3000 });
        await expect(page.locator('.day-section.today').getByText(text)).toBeVisible();

        // Clean up the UI-created task (the cleanup helper only tracks
        // API-created entities).
        const res = await page.request.get(`${SERVER_URL}/api/tasks`);
        const tasks = (await res.json()).data as Array<{ id: string; text: string }>;
        for (const t of tasks) {
            if (t.text === text) {
                await page.request.delete(`${SERVER_URL}/api/tasks/${t.id}`);
            }
        }
    });

    test('"/add" parses a natural-language date and #tags', async ({ page }) => {
        const text = uniq('PaletteNL');
        await hydrated(page);
        await page.keyboard.press('/');
        const modalEl = modal(page, 'Search');
        await expect(modalEl).toBeVisible();
        await modalEl.getByLabel('Search tasks').fill(`/add ${text} tomorrow #nlwork`);
        await modalEl.getByLabel('Search tasks').press('Enter');

        await expect(modalEl).toBeHidden();
        const tomorrow = dayISO(1);
        const section = page.locator(`section#day-${tomorrow}`);
        const row = section.locator('.task-row', { hasText: text });
        await expect(row).toBeVisible();
        // The #tag became a real tag on the task, not literal text: the
        // task text is exactly the name typed before the phrase.
        await expect(row.locator('.task-text')).toHaveText(text);
        await expect(row.locator('.tag-chip', { hasText: 'nlwork' })).toBeVisible();

        // Clean up the UI-created task (the cleanup helper only tracks
        // API-created entities). Match the uniq prefix so leftovers from
        // a failed earlier attempt do not linger on the shared server.
        const res = await page.request.get(`${SERVER_URL}/api/tasks`);
        const tasks = (await res.json()).data as Array<{ id: string; text: string }>;
        for (const t of tasks) {
            if (t.text.includes('PaletteNL')) {
                await page.request.delete(`${SERVER_URL}/api/tasks/${t.id}`);
            }
        }
    });

    test('"/go" jumps the day list to a parsed date', async ({ page }) => {
        await hydrated(page);
        await page.keyboard.press('/');
        const modalEl = modal(page, 'Search');
        await expect(modalEl).toBeVisible();
        await modalEl.getByLabel('Search tasks').fill('/go in 3 days');
        await modalEl.getByLabel('Search tasks').press('Enter');

        await expect(modalEl).toBeHidden();
        const section = page.locator(`section#day-${dayISO(3)}`);
        await expect(section).toBeVisible();
        // The day list centers the target section after a smooth scroll;
        // poll the geometry until it has settled inside the viewport
        // (same pattern as calendar.spec.ts).
        await expect
            .poll(async () => {
                const box = await section.boundingBox();
                return box !== null && box.y > 0 && box.y < 600;
            })
            .toBe(true);
    });

    test('"/complete" completes a matching task', async ({ page }) => {
        const text = uniq('PaletteDone');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);
        const row = page.locator('.task-row', { hasText: text });
        await expect(row).toBeVisible();
        await expect(row).not.toHaveClass(/completed/);

        await page.keyboard.press('/');
        const modalEl = modal(page, 'Search');
        await expect(modalEl).toBeVisible();
        await modalEl.getByLabel('Search tasks').fill(`/complete ${text}`);
        await modalEl.getByLabel('Search tasks').press('Enter');

        await expect(modalEl).toBeHidden();
        await expect(page.getByText(`Completed "${text}"`)).toBeVisible({ timeout: 3000 });
        await expect(row).toHaveClass(/completed/);
    });

    test('"/move" reschedules a task to a parsed date', async ({ page }) => {
        const text = uniq('PaletteMove');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);
        await expect(page.locator(`section#day-${todayISO()}`).getByText(text)).toBeVisible();

        await page.keyboard.press('/');
        const modalEl = modal(page, 'Search');
        await expect(modalEl).toBeVisible();
        await modalEl.getByLabel('Search tasks').fill(`/move ${text} to tomorrow`);
        await modalEl.getByLabel('Search tasks').press('Enter');

        await expect(modalEl).toBeHidden();
        await expect(page.locator(`section#day-${dayISO(1)}`).getByText(text)).toBeVisible();
        await expect(page.locator(`section#day-${todayISO()}`).getByText(text)).toHaveCount(0);
    });

    test('"/filter" applies a tag filter and "/clear" resets it', async ({ page }) => {
        const tagged = uniq('PaletteTagged');
        const other = uniq('PaletteOther');
        await createTask(
            page.request,
            { text: tagged, date: todayISO(), tags: ['palettefilter'] },
            SERVER_URL,
        );
        await createTask(page.request, { text: other, date: todayISO() }, SERVER_URL);
        await hydrated(page);
        const todaySection = page.locator(`section#day-${todayISO()}`);
        await expect(todaySection.getByText(other)).toBeVisible();

        await page.keyboard.press('/');
        let modalEl = modal(page, 'Search');
        await expect(modalEl).toBeVisible();
        await modalEl.getByLabel('Search tasks').fill('/filter palettefilter');
        await modalEl.getByLabel('Search tasks').press('Enter');
        await expect(modalEl).toBeHidden();

        // Only the tagged task remains in the day list.
        await expect(todaySection.getByText(tagged)).toBeVisible();
        await expect(todaySection.getByText(other)).toHaveCount(0);

        // "/clear" brings the untagged task back.
        await page.keyboard.press('/');
        modalEl = modal(page, 'Search');
        await expect(modalEl).toBeVisible();
        await modalEl.getByLabel('Search tasks').fill('/clear');
        await modalEl.getByLabel('Search tasks').press('Enter');
        await expect(modalEl).toBeHidden();
        await expect(todaySection.getByText(other)).toBeVisible();
    });
});

test.describe('Trash modal', () => {
    test('deleted tasks appear in the trash and can be restored', async ({ page }) => {
        const text = uniq('TrashMe');
        const task = await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        // Soft-delete via the API, then open trash.
        await del(page.request, `/api/tasks/${task.id}`, SERVER_URL);
        await hydrated(page);
        await page.getByRole('button', { name: 'Trash', exact: true }).click();
        const trash = modal(page, 'Trash');
        await expect(trash).toBeVisible();
        await expect(trash.getByText(text).first()).toBeVisible();
        // Restore from the trash.
        await trash.getByRole('button', { name: 'Restore task' }).first().click();
        // Server confirms restoration.
        const res = await page.request.get(`${SERVER_URL}/api/tasks/${task.id}`);
        expect(res.status()).toBe(200);
        expect((await res.json()).data.deletedAt).toBeNull();
    });

    test('trash lists deleted tasks each with a restore button', async ({ page }) => {
        // Seed at least one deleted task so the trash has known content.
        const a = await createTask(page.request, { text: uniq('TrashA'), date: todayISO() }, SERVER_URL);
        const b = await createTask(page.request, { text: uniq('TrashB'), date: todayISO() }, SERVER_URL);
        await del(page.request, `/api/tasks/${a.id}`, SERVER_URL);
        await del(page.request, `/api/tasks/${b.id}`, SERVER_URL);
        await hydrated(page);
        await page.getByRole('button', { name: 'Trash', exact: true }).click();
        const trash = modal(page, 'Trash');
        await expect(trash).toBeVisible();
        // Each listed deleted task exposes a restore affordance.
        const restoreButtons = trash.getByRole('button', { name: 'Restore task' });
        await expect(restoreButtons.first()).toBeVisible();
        expect(await restoreButtons.count()).toBeGreaterThanOrEqual(2);
    });
});

test.describe('Filter modal', () => {
    // Filter state persists in the server's preferences -- reset it so
    // later specs (this file and every other) see the default view.
    test.afterEach(async ({ request }) => {
        await patch(
            request,
            '/api/preferences',
            {
                data: {
                    activeFilters: {
                        tags: [],
                        showCompleted: true,
                        sortMode: 'manual',
                        dateFrom: null,
                        dateTo: null,
                    },
                },
            },
            SERVER_URL,
        ).catch(() => {});
    });

    test('priority sort reorders tasks within a day and adds accents', async ({ page }) => {
        const p1Text = uniq('FilterP1');
        const p2Text = uniq('FilterP2');
        const plainText = uniq('FilterPlain');
        // Creation order is plain, p2, p1 -- priority sort must flip it.
        await createTask(page.request, { text: plainText, date: todayISO() }, SERVER_URL);
        await createTask(page.request, { text: p2Text, date: todayISO(), tags: ['p2'] }, SERVER_URL);
        await createTask(page.request, { text: p1Text, date: todayISO(), tags: ['p1'] }, SERVER_URL);
        await hydrated(page);
        const todaySection = page.locator(`section#day-${todayISO()}`);
        await expect(todaySection.getByText(p1Text)).toBeVisible();

        await page.getByRole('button', { name: 'Filter', exact: true }).click();
        const modalEl = modal(page, 'Filter');
        await expect(modalEl).toBeVisible();
        await modalEl.locator('input[value="priority"]').check();

        // Within today's section the p1 task now precedes p2, which
        // precedes the untagged one (relative order -- immune to foreign
        // tasks from other specs). The sorted re-render lands async, so
        // poll instead of sampling once.
        await expect
            .poll(async () => {
                // allTextContents keeps the template's whitespace around the
                // task text -- trim before comparing.
                const order = (await todaySection.locator('.task-text').allTextContents()).map(
                    t => t.trim(),
                );
                return (
                    order.indexOf(p1Text) < order.indexOf(p2Text) &&
                    order.indexOf(p2Text) < order.indexOf(plainText)
                );
            })
            .toBe(true);

        // The priority rows carry their accent while the sort is active.
        await expect(page.locator('.task-row.prio-1', { hasText: p1Text })).toBeVisible();
        await expect(page.locator('.task-row.prio-2', { hasText: p2Text })).toBeVisible();
        await expect(page.locator('.task-row.prio-3')).toHaveCount(0);
    });

    test('date range narrows the day list and Clear restores it', async ({ page }) => {
        const inRange = uniq('RangeIn');
        const outOfRange = uniq('RangeOut');
        await createTask(page.request, { text: inRange, date: todayISO() }, SERVER_URL);
        await createTask(
            page.request,
            { text: outOfRange, date: dayISO(20) },
            SERVER_URL,
        );
        await hydrated(page);
        await expect(page.locator(`section#day-${todayISO()}`).getByText(inRange)).toBeVisible();
        await expect(page.locator(`section#day-${dayISO(20)}`).getByText(outOfRange)).toBeVisible();

        await page.getByRole('button', { name: 'Filter', exact: true }).click();
        const modalEl = modal(page, 'Filter');
        await expect(modalEl).toBeVisible();
        await modalEl.getByLabel('From').fill(todayISO());
        await modalEl.getByLabel('To').fill(dayISO(7));

        // Days outside the range stop rendering entirely; the in-range
        // task stays visible.
        await expect(page.locator(`section#day-${dayISO(20)}`)).toHaveCount(0);
        await expect(page.locator(`section#day-${todayISO()}`).getByText(inRange)).toBeVisible();

        // Clearing the range brings the far day back.
        await modalEl.getByRole('button', { name: 'Clear', exact: true }).click();
        await expect(page.locator(`section#day-${dayISO(20)}`).getByText(outOfRange)).toBeVisible();
    });
});

test.describe('Projects modal', () => {
    test('deleting a project asks for confirmation and can be declined', async ({ page }) => {
        const name = uniq('ConfirmDelete Project');
        const project = await createProject(page.request, { name }, SERVER_URL);
        await hydrated(page);
        await page.getByRole('button', { name: 'Projects', exact: true }).click();
        const projects = modal(page, 'Projects');
        const card = projects.locator('.project-card', { hasText: name });
        await expect(card).toBeVisible();

        // Decline: the project survives.
        await card.getByRole('button', { name: 'Delete project' }).click();
        const dialog = modal(page, 'Confirm');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(`Delete "${name}"?`);
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        let res = await page.request.get(`${SERVER_URL}/api/projects/${project.id}`);
        expect(res.status()).toBe(200);

        // Confirm: the project is gone server-side.
        await card.getByRole('button', { name: 'Delete project' }).click();
        await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
        await expect(card).toHaveCount(0);
        res = await page.request.get(`${SERVER_URL}/api/projects/${project.id}`);
        expect(res.status()).toBe(404);
    });
});
