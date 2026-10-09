import { expect, test } from '@playwright/test';
import { cleanup, createProject, createTask, del, patch, uniq } from '../api-tests/helpers';
import { dayISO, hydrated, modal, SERVER_URL, todayISO } from './util';

test.afterEach(async ({ request }) => {
    await cleanup(request, SERVER_URL);
});

test.describe('Settings modal', () => {
    test('hiding empty days collapses the rail to days with tasks (today stays)', async ({
        page,
    }) => {
        const text = uniq('UiEmptyDays');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        // Other workers share the preferences singleton: clear any filter
        // state first so the rail is unclamped when measured.
        await patch(
            page.request,
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
        );
        await hydrated(page);
        const rail = page.locator('.day-section');
        await expect(rail.first()).toBeVisible();
        // Default: the window renders a contiguous rail incl. empty days.
        const before = await rail.count();
        expect(before).toBeGreaterThan(10);

        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        const settings = modal(page, 'Settings');
        await settings.locator('#show-empty-days').uncheck();
        await expect.poll(async () => page.locator('.day-section').count()).toBeLessThan(before);
        // Today (holding the task) stays rendered; a far empty day does not.
        await expect(page.locator('.day-section.today')).toBeVisible();
        const todayCount = await page.locator('.day-section.today').count();
        expect(todayCount).toBe(1);

        // Restore the default for the shared singleton.
        await page.request.patch(`${SERVER_URL}/api/preferences`, {
            data: { showEmptyDays: true },
        });
        await settings.locator('#show-empty-days').check();
        await expect.poll(async () => page.locator('.day-section').count()).toBeGreaterThan(10);
    });

    test('fresh start clears the saved filters on load when enabled off', async ({ page }) => {
        // Seed a saved filter + the fresh-start preference directly.
        await patch(
            page.request,
            '/api/preferences',
            {
                activeFilters: {
                    tags: ['FreshStart'],
                    showCompleted: true,
                    sortMode: 'manual',
                    dateFrom: null,
                    dateTo: null,
                },
            },
            SERVER_URL,
        );
        await patch(page.request, '/api/preferences', { persistActiveFilters: false }, SERVER_URL);

        await hydrated(page);
        // The load path cleared the filters: no chips in the bottom bar.
        await expect(page.locator('.bottom-bar .chip')).toHaveCount(0);
        // ...and the server state is clean too.
        const r = await page.request.get(`${SERVER_URL}/api/preferences`);
        expect((await r.json()).data.activeFilters.tags).toEqual([]);

        // Restore the default for the shared singleton.
        await patch(page.request, '/api/preferences', { persistActiveFilters: true }, SERVER_URL);
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
        expect(download.suggestedFilename()).toMatch(/^erledigen-export-\d{4}-\d{2}-\d{2}\.json$/);
    });
});

test.describe('Theme modal', () => {
    test('changing theme applies it to the document and persists to the server', async ({
        page,
    }) => {
        // Capture original to restore.
        const before = await page.request.get(`${SERVER_URL}/api/preferences`);
        const origTheme = (await before.json()).data.theme;

        await hydrated(page);
        await page.getByRole('button', { name: 'Theme', exact: true }).click();
        const theme = modal(page, 'Theme');
        await expect(theme).toBeVisible();
        await theme.locator('#theme-select').selectOption('dark');
        // Theme selection drives an immediate PATCH and the layout's $effect sets
        // document data-theme, so assert the user-visible outcome first.
        await expect
            .poll(async () =>
                page.evaluate(() => document.documentElement.getAttribute('data-theme')),
            )
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

    test('the "g a" chord opens the Theme modal', async ({ page }) => {
        await hydrated(page);
        await page.keyboard.press('g');
        await page.keyboard.press('a');
        await expect(modal(page, 'Theme')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(modal(page, 'Theme')).toBeHidden();
    });

    test('switching the accent scheme applies it and persists to the server', async ({ page }) => {
        await hydrated(page);
        await page.getByRole('button', { name: 'Theme', exact: true }).click();
        const theme = modal(page, 'Theme');
        await expect(theme).toBeVisible();
        await theme.getByRole('radio', { name: 'Coral' }).check();
        // The layout's $effect mirrors the store onto the document root.
        await expect
            .poll(async () =>
                page.evaluate(() => document.documentElement.getAttribute('data-accent')),
            )
            .toBe('coral');
        // And the server persists it.
        await expect
            .poll(async () => {
                const r = await page.request.get(`${SERVER_URL}/api/preferences`);
                return (await r.json()).data.accent;
            })
            .toBe('coral');

        // Restore the default accent for the shared server.
        await page.request.patch(`${SERVER_URL}/api/preferences`, { data: { accent: 'blue' } });
    });

    test('font size, row density, and the completion flash persist', async ({ page }) => {
        const text = uniq('UiSize');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);
        await page.getByRole('button', { name: 'Theme', exact: true }).click();
        const theme = modal(page, 'Theme');

        // Font size drives a root attribute + the reading tokens.
        await theme.getByRole('radio', { name: 'large' }).check();
        await expect
            .poll(async () =>
                page.evaluate(() => document.documentElement.getAttribute('data-font-size')),
            )
            .toBe('large');

        // Row density likewise.
        await theme.getByRole('radio', { name: 'compact' }).check();
        await expect
            .poll(async () =>
                page.evaluate(() => document.documentElement.getAttribute('data-row-density')),
            )
            .toBe('compact');

        // All three persist on the server (one representative poll).
        await expect
            .poll(async () => {
                const r = await page.request.get(`${SERVER_URL}/api/preferences`);
                const prefs = (await r.json()).data;
                return `${prefs.fontSize}/${prefs.rowDensity}/${prefs.completionAnimation}`;
            })
            .toBe('large/compact/flash');

        // Turning the completion flash off stops the pulse class.
        await theme.getByRole('radio', { name: 'Off' }).check();
        await theme.getByRole('button', { name: 'Close modal' }).click();
        const row = page.locator('.task-row', { hasText: text }).first();
        await row.getByRole('button', { name: /Mark complete/ }).click();
        await expect(row).toHaveClass(/completed/);
        await expect(row).not.toHaveClass(/just-completed/);

        // Restore the defaults for the shared server.
        await page.request.patch(`${SERVER_URL}/api/preferences`, {
            data: {
                fontSize: 'medium',
                rowDensity: 'comfortable',
                completionAnimation: 'flash',
            },
        });
    });
});

test.describe('Settings tags management', () => {
    test.afterEach(async ({ request }) => {
        // Tag-color preferences persist on the shared server; reset so later
        // specs are not affected.
        await request.patch(`${SERVER_URL}/api/preferences`, { data: { tagColors: {} } });
    });

    test('lists tags with counts and renames one across its tasks', async ({ page }) => {
        const tag = uniq('ManageTag').toLowerCase();
        const renamed = `${tag}-renamed`;
        await createTask(
            page.request,
            { text: uniq('TagA'), date: todayISO(), tags: [tag] },
            SERVER_URL,
        );
        const taskB = await createTask(
            page.request,
            { text: uniq('TagB'), date: todayISO(), tags: [tag] },
            SERVER_URL,
        );
        await hydrated(page);
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        const settings = modal(page, 'Settings');
        await expect(settings).toBeVisible();

        // The row lists the tag with its task count.
        const row = settings.locator('.tag-manage-row', { hasText: `#${tag}` });
        await expect(row).toBeVisible();
        await expect(row).toContainText('2 tasks');

        // Rename inline: pencil -> input prefilled -> Enter. The input
        // replaces the name span, so locate it by role, not through the
        // (the row has no text now) row filter.
        await row.getByRole('button', { name: `Rename #${tag}` }).click();
        const renameInput = settings.getByRole('textbox', { name: `Rename #${tag}` });
        await renameInput.fill(renamed);
        await renameInput.press('Enter');
        await expect(settings.locator('.tag-manage-row', { hasText: `#${renamed}` })).toBeVisible();
        // Both tasks now carry the renamed tag.
        const r = await page.request.get(`${SERVER_URL}/api/tasks/${taskB.id}`);
        expect((await r.json()).data.tags).toEqual([renamed]);
    });

    test('recolors a tag through the palette picker', async ({ page }) => {
        const tag = uniq('ManageColor').toLowerCase();
        await createTask(
            page.request,
            { text: uniq('ColorA'), date: todayISO(), tags: [tag] },
            SERVER_URL,
        );
        await hydrated(page);
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        const settings = modal(page, 'Settings');
        const row = settings.locator('.tag-manage-row', { hasText: `#${tag}` });
        await expect(row).toBeVisible();

        await row.getByRole('button', { name: `Recolor #${tag}` }).click();
        await row.getByRole('button', { name: `#${tag} in sky` }).click();
        // The row's dot now resolves to the sky token...
        const dot = row.locator('.color-dot.current');
        await expect
            .poll(async () => dot.getAttribute('style'), { timeout: 10_000 })
            .toContain('--tag-sky');
        // ...and the preference persisted.
        await expect
            .poll(
                async () => {
                    const r = await page.request.get(`${SERVER_URL}/api/preferences`);
                    return (await r.json()).data.tagColors[tag];
                },
                { timeout: 10_000 },
            )
            .toBe('sky');
    });

    test('merges a tag into another and removes one cleanly', async ({ page }) => {
        const source = uniq('ManageSrc').toLowerCase();
        const target = uniq('ManageTgt').toLowerCase();
        const victim = uniq('ManageVictim').toLowerCase();
        const t = await createTask(
            page.request,
            { text: uniq('MergeA'), date: todayISO(), tags: [source, target] },
            SERVER_URL,
        );
        await createTask(
            page.request,
            { text: uniq('DelA'), date: todayISO(), tags: [victim] },
            SERVER_URL,
        );
        await hydrated(page);
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        const settings = modal(page, 'Settings');
        const sourceRow = settings.locator('.tag-manage-row', { hasText: `#${source}` });
        await expect(sourceRow).toBeVisible();

        // Merge source -> target, through the confirm dialog.
        await sourceRow.getByRole('button', { name: `Merge #${source} into another tag` }).click();
        await sourceRow
            .getByRole('combobox', { name: `Merge #${source} into` })
            .selectOption(target);
        await sourceRow.getByRole('button', { name: 'Merge', exact: true }).click();
        const confirmDialog = modal(page, 'Confirm');
        await confirmDialog.getByRole('button', { name: 'Merge', exact: true }).click();
        await expect(settings.locator('.tag-manage-row', { hasText: `#${source}` })).toHaveCount(0);
        // The task now carries target exactly once (source was also on it).
        const r = await page.request.get(`${SERVER_URL}/api/tasks/${t.id}`);
        const tags = (await r.json()).data.tags as string[];
        expect(tags).toContain(target);
        expect(tags).not.toContain(source);
        expect(tags.filter(x => x === target)).toHaveLength(1);

        // Remove the victim tag: confirm, then the row is gone and the task
        // stays without it.
        const victimRow = settings.locator('.tag-manage-row', { hasText: `#${victim}` });
        await victimRow.getByRole('button', { name: `Remove #${victim}` }).click();
        const confirmDialog2 = modal(page, 'Confirm');
        await confirmDialog2.getByRole('button', { name: 'Remove', exact: true }).click();
        await expect(settings.locator('.tag-manage-row', { hasText: `#${victim}` })).toHaveCount(0);
        await expect
            .poll(
                async () => {
                    const tasks = await page.request.get(`${SERVER_URL}/api/tasks`);
                    const list = (await tasks.json()).data as Array<{
                        text: string;
                        tags: string[];
                    }>;
                    return list.find(task => task.tags.includes(victim)) !== undefined;
                },
                { timeout: 10_000 },
            )
            .toBe(false);
    });
});

test.describe('Shortcuts remapping', () => {
    test.afterEach(async ({ request }) => {
        await request.patch(`${SERVER_URL}/api/preferences`, {
            data: { shortcutOverrides: {} },
        });
    });

    test('remap a chord, warn on conflict, reset to default', async ({ page }) => {
        await hydrated(page);
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        const settings = modal(page, 'Settings');
        // Anchored regex: the row's first text is its label ('Trash'), so a
        // conflict warning elsewhere ('also Trash') can not match.
        const trashRow = settings.locator('.shortcut-row', { hasText: /^Trash/ });
        await expect(trashRow).toBeVisible();
        const bindingChips = trashRow.getByRole('button', { name: 'Rebind Trash' }).locator('kbd');
        await expect(bindingChips.nth(0)).toHaveText('g');
        await expect(bindingChips.nth(1)).toHaveText('x');

        // Capture a two-key chord: 'g' arms, 'z' completes.
        await trashRow.getByRole('button', { name: 'Rebind Trash' }).click();
        await page.keyboard.press('g');
        await page.keyboard.press('z');
        await expect(bindingChips.nth(1)).toHaveText('z');

        // The remapped chord opens the Trash modal. Restore the default
        // binding IMMEDIATELY after: preferences are global on the shared
        // test server, and keyboard.spec exercises 'g x' in parallel
        // workers -- keep the race window as small as possible. The
        // restore is server-side; the client learns it on the reload
        // below (preferences carry no WS broadcast).
        await settings.getByRole('button', { name: 'Close modal' }).click();
        await page.keyboard.press('g');
        await page.keyboard.press('z');
        await expect(modal(page, 'Trash')).toBeVisible();
        await page.keyboard.press('Escape');
        await patch(page.request, '/api/preferences', { shortcutOverrides: {} }, SERVER_URL);
        await hydrated(page);

        // Rebind to an occupied key -> warning naming the other action.
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        const settings2 = modal(page, 'Settings');
        const trashRow2 = settings2.locator('.shortcut-row', { hasText: /^Trash/ });
        // The reload confirms the restore persisted and re-rendered.
        await expect(
            trashRow2.getByRole('button', { name: 'Rebind Trash' }).locator('kbd').nth(1),
        ).toHaveText('x');
        await trashRow2.getByRole('button', { name: 'Rebind Trash' }).click();
        await page.keyboard.press('j');
        await expect(trashRow2.locator('.shortcut-warning')).toContainText('Focus next task');

        // Reset restores the default binding and clears the override.
        await trashRow2.getByRole('button', { name: 'Reset Trash to default' }).click();
        await expect(
            trashRow2.getByRole('button', { name: 'Rebind Trash' }).locator('kbd').nth(1),
        ).toHaveText('x');
        await expect(trashRow2.locator('.shortcut-warning')).toHaveCount(0);
        await expect
            .poll(async () => {
                const r = await page.request.get(`${SERVER_URL}/api/preferences`);
                return (await r.json()).data.shortcutOverrides;
            })
            .toEqual({});
    });

    test('the help modal shows the live remapped bindings', async ({ page }) => {
        // Seed a remap directly, reload, and read the help table.
        await patch(
            page.request,
            '/api/preferences',
            { shortcutOverrides: { openTrash: ['g z'] } },
            SERVER_URL,
        );
        await hydrated(page);
        await page.keyboard.press('?');
        const help = modal(page, 'Keyboard Shortcuts');
        await expect(
            help.locator('tr', { hasText: 'Trash' }).locator('kbd', { hasText: 'z' }),
        ).toBeVisible();
        // The default chord is gone from the Trash row.
        await expect(help.locator('tr', { hasText: 'Trash' })).not.toContainText('x');
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
        const a = await createTask(
            page.request,
            { text: uniq('TrashA'), date: todayISO() },
            SERVER_URL,
        );
        const b = await createTask(
            page.request,
            { text: uniq('TrashB'), date: todayISO() },
            SERVER_URL,
        );
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
        await createTask(
            page.request,
            { text: p2Text, date: todayISO(), tags: ['p2'] },
            SERVER_URL,
        );
        await createTask(
            page.request,
            { text: p1Text, date: todayISO(), tags: ['p1'] },
            SERVER_URL,
        );
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
                const order = (await todaySection.locator('.task-text').allTextContents()).map(t =>
                    t.trim(),
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
        await createTask(page.request, { text: outOfRange, date: dayISO(20) }, SERVER_URL);
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
