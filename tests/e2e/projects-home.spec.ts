import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import {
    cleanup,
    createList,
    createProject,
    createRecurring,
    createTask,
    uniq,
} from '../api/helpers';
import { dayISO, hydrated, modal, SERVER_URL, todayISO } from './util';

const PREFIX = 'ProjectHomeE2E';

test.afterEach(async ({ request }) => {
    await cleanup(request, SERVER_URL);
});

/** Open the Projects modal and hop into one project's home. */
async function openHome(page: Page, projectName: string) {
    await hydrated(page);
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    const projects = modal(page, 'Projects');
    await projects.getByRole('button', { name: new RegExp(`Open project ${projectName}`) }).click();
    const home = projects.locator('.detail-view');
    await expect(home).toBeVisible();
    return { projects, home };
}

test.describe('project home (USE-17)', () => {
    test('gathers every member: backlog by list, scheduled by day, routines, done', async ({
        page,
    }) => {
        const name = uniq(`${PREFIX} House`);
        const project = await createProject(page.request, { name }, SERVER_URL);
        const list = await createList(
            page.request,
            { tabId: 'default', name: uniq('Rooms'), position: 0 },
            SERVER_URL,
        );

        // One parked in a list, one scheduled, one done, one routine.
        await createTask(
            page.request,
            {
                text: uniq(`${PREFIX} parked`),
                date: null,
                somedayListId: list.id,
                tags: [project['tag']],
            },
            SERVER_URL,
        );
        await createTask(
            page.request,
            {
                text: uniq(`${PREFIX} scheduled`),
                date: '2026-03-01',
                tags: [project['tag']],
            },
            SERVER_URL,
        );
        const done = await createTask(
            page.request,
            {
                text: uniq(`${PREFIX} done`),
                date: '2026-03-02',
                tags: [project['tag']],
            },
            SERVER_URL,
        );
        await page.request.put(`${SERVER_URL}/api/tasks/${done.id}`, {
            data: { completed: true },
        });
        await createRecurring(
            page.request,
            {
                text: uniq(`${PREFIX} water the site`),
                tags: [project['tag']],
                frequency: 'daily',
                startDate: '2026-01-01',
            },
            SERVER_URL,
        );

        const { home } = await openHome(page, name);

        // Backlog groups by list; the parked task sits under its list.
        const backlog = home.locator('.home-section', { hasText: 'Backlog' });
        await expect(backlog.locator('.home-group-title')).toHaveText([list['name']]);
        await expect(backlog.locator('.task-row', { hasText: 'parked' })).toBeVisible();

        // Scheduled groups by day.
        const scheduled = home.locator('.home-section', { hasText: 'Scheduled' });
        await expect(scheduled.locator('.task-row', { hasText: 'scheduled' })).toBeVisible();

        // The routine wears the tag and gathers here.
        const routines = home.locator('.home-section', { hasText: 'Routines' });
        await expect(routines.locator('.routine-row', { hasText: 'water the site' })).toBeVisible();

        // Done counts and shows the recent completion.
        const doneSection = home.locator('#project-done-heading').locator('..');
        await expect(doneSection.locator('.task-row', { hasText: 'done' })).toBeVisible();
    });

    test('add from the home applies the project tag and parks in the project tab', async ({
        page,
    }) => {
        const name = uniq(`${PREFIX} Tabbed`);
        const project = await createProject(page.request, { name }, SERVER_URL);

        const { home, projects } = await openHome(page, name);

        // The grammar input carries the tag. UI-created tasks are not
        // tracked by the API cleanup helper, so the exact text is both
        // the assertion anchor and the cleanup key.
        const newText = uniq(`${PREFIX} from home`);
        const input = home.locator('.add-input');
        await input.fill(newText);
        await input.press('Enter');
        const first = home.locator('.task-row', { hasText: 'from home' });
        await expect(first).toBeVisible();

        // Server-side: the member wears the tag.
        const tasksRes = await page.request.get(`${SERVER_URL}/api/tasks`);
        const created = (
            (await tasksRes.json()).data as Array<{
                id: string;
                text: string;
                tags: string[];
                date: string | null;
            }>
        ).find(t => t.text === newText);
        expect(created?.tags).toContain(project['tag']);
        expect(created?.date).toBeNull();

        // Delete what the UI created (the API helper never saw it).
        if (created) await page.request.delete(`${SERVER_URL}/api/tasks/${created.id}`);
        await projects.getByRole('button', { name: 'Close modal' }).click();
    });

    test('mark complete stamps completedAt; reopen clears it', async ({ page }) => {
        const name = uniq(`${PREFIX} Finish`);
        const project = await createProject(page.request, { name }, SERVER_URL);
        const { home } = await openHome(page, name);

        await home.getByRole('button', { name: 'Mark complete' }).click();
        await expect(home.getByRole('button', { name: 'Reopen' })).toBeVisible();

        const after = await (
            await page.request.get(`${SERVER_URL}/api/projects/${project.id}`)
        ).json();
        expect(after.data.completedAt).toBeTruthy();

        await home.getByRole('button', { name: 'Reopen' }).click();
        await expect(home.getByRole('button', { name: 'Mark complete' })).toBeVisible();
        const reopened = await (
            await page.request.get(`${SERVER_URL}/api/projects/${project.id}`)
        ).json();
        expect(reopened.data.completedAt).toBeNull();
    });

    test('the hill marker drags and persists', async ({ page }) => {
        const name = uniq(`${PREFIX} Hill`);
        const project = await createProject(page.request, { name }, SERVER_URL);
        const { home } = await openHome(page, name);

        const hill = home.getByLabel('Project hill progress');
        // Range inputs do not accept fill(): set the value through the
        // element and drive the app's own input/change handlers (the
        // keyboard path is the arrow keys, covered by the a11y audit).
        await hill.evaluate((el: HTMLInputElement) => {
            el.value = '60';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await hill.blur();

        await expect(async () => {
            const after = await (
                await page.request.get(`${SERVER_URL}/api/projects/${project.id}`)
            ).json();
            expect(after.data.hillPosition).toBe(60);
        }).toPass();

        // The phase caption reads, not a percentage (ADR-011).
        await expect(home.locator('.hill-phase')).toContainText('executing');
    });

    test('a day task with the project tag hops to the home from its chip', async ({ page }) => {
        const name = uniq(`${PREFIX} Chip`);
        const project = await createProject(page.request, { name }, SERVER_URL);
        await createTask(
            page.request,
            {
                text: uniq(`${PREFIX} chipped task`),
                date: todayISO(),
                tags: [project['tag']],
            },
            SERVER_URL,
        );

        await hydrated(page);
        // The project chip renders in the day row.
        const chip = page
            .locator('.day-section')
            .locator('.task-row', { hasText: 'chipped task' })
            .getByRole('button', { name: `Open the project ${name}` });
        await expect(chip).toBeVisible();
        await chip.click();

        // The Projects modal opens straight onto the project's home.
        const home = modal(page, 'Projects').locator('.detail-view');
        await expect(home).toBeVisible();
        await expect(home.locator('.detail-name')).toHaveText(name);
    });
});

test.describe('project milestones on their days (USE-19)', () => {
    test('start, due, and completed dates draw banner notes', async ({ page }) => {
        const name = uniq(`${PREFIX} Milestones`);
        const today = todayISO();
        const tomorrow = dayISO(1);
        const project = await createProject(
            page.request,
            { name, startDate: today, dueDate: tomorrow },
            SERVER_URL,
        );
        // Stamp it complete today: the completed note lands on today.
        await page.request.put(`${SERVER_URL}/api/projects/${project.id}`, {
            data: { completedAt: `${today}T12:00:00.000Z` },
        });

        await hydrated(page);
        // Today draws "X starts" and "X completed"; tomorrow draws "X due".
        const todaySection = page.locator('.day-section.today');
        await expect(
            todaySection.locator('.milestone-banner').filter({ hasText: 'starts' }),
        ).toContainText(`${name} starts`);
        await expect(
            todaySection.locator('.milestone-banner').filter({ hasText: 'completed' }),
        ).toContainText(`${name} completed`);
        await expect(
            page
                .locator(`#day-${tomorrow}`)
                .locator('.milestone-banner')
                .filter({ hasText: 'due' }),
        ).toContainText(`${name} due`);
    });

    test('an uncompleted overdue project nags on today', async ({ page }) => {
        const name = uniq(`${PREFIX} Overdue`);
        await createProject(page.request, { name, dueDate: dayISO(-1) }, SERVER_URL);

        await hydrated(page);
        const todaySection = page.locator('.day-section.today');
        await expect(todaySection.locator('.milestone-banner.due')).toContainText(`${name} due`);
    });

    test('a completed overdue project stops nagging', async ({ page }) => {
        const name = uniq(`${PREFIX} Forgiven`);
        const project = await createProject(
            page.request,
            { name, dueDate: dayISO(-1) },
            SERVER_URL,
        );
        await page.request.put(`${SERVER_URL}/api/projects/${project.id}`, {
            data: { completedAt: `${todayISO()}T12:00:00.000Z` },
        });

        await hydrated(page);
        const todaySection = page.locator('.day-section.today');
        await expect(
            todaySection.locator('.milestone-banner.due', { hasText: `${name} due` }),
        ).toHaveCount(0);
    });
});
