import { expect, test } from '@playwright/test';
import { cleanup, createProject, put, track, uniq } from '../api-tests/helpers';
import { dayISO, hydrated, modal, SERVER_URL, todayISO } from './util';

/**
 * Project-detail Kanban board (v0.9.0): columns map onto real task state
 * (Ready = undated, Scheduled = dated, Done = completed), so drags are
 * verified against the server, not just the DOM.
 */

const MARKER = 'KanbanE2E';

test.afterEach(async ({ request }) => {
    await cleanup(request, SERVER_URL);
});

/** Create a project (auto-generates its tag) + a task inside it. */
async function projectTask(
    request: import('@playwright/test').APIRequestContext,
    tag: string,
    overrides: Record<string, unknown>,
): Promise<{ id: string; text: string }> {
    const text = uniq(`${MARKER} Task`);
    const res = await request.post(`${SERVER_URL}/api/tasks`, {
        data: { text, tags: [tag], ...overrides },
    });
    expect(res.status()).toBe(201);
    const task = (await res.json()).data as { id: string; text: string };
    track('task', task.id, SERVER_URL);
    return task;
}

/** Open the Projects modal, enter the project's detail view. The card's
 *  accessible name carries the active/inactive status. */
async function openBoard(
    page: import('@playwright/test').Page,
    projectName: string,
    status: 'active' | 'inactive' = 'active',
) {
    await hydrated(page);
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await expect(modal(page, 'Projects')).toBeVisible();
    // Readiness: the store fetch must land before the card renders.
    await page.getByRole('button', { name: `${projectName}, ${status}` }).click();
    const board = page.locator('.kanban');
    await expect(board).toBeVisible();
    return board;
}

test.describe('project Kanban board', () => {
    test('renders the three columns with the right cards; sub-tasks stay off', async ({ page }) => {
        const projectName = uniq(`${MARKER} Board columns`);
        const project = await createProject(page.request, { name: projectName }, SERVER_URL);
        await projectTask(page.request, project['tag'], { date: null });
        await projectTask(page.request, project['tag'], { date: todayISO() });
        await projectTask(page.request, project['tag'], { date: null, completed: false });
        const done = await projectTask(page.request, project['tag'], { date: todayISO() });
        await put(page.request, `/api/tasks/${done.id}`, { completed: true }, SERVER_URL);
        const sub = await projectTask(page.request, project['tag'], { date: null });
        await put(page.request, `/api/tasks/${sub.id}`, { parentId: done.id }, SERVER_URL);

        const board = await openBoard(page, projectName);

        await expect(
            board.locator('.kanban-column[aria-label="Ready column"] .kanban-card'),
        ).toHaveCount(2);
        await expect(
            board.locator('.kanban-column[aria-label="Scheduled column"] .kanban-card'),
        ).toHaveCount(1);
        await expect(
            board.locator('.kanban-column[aria-label="Done column"] .kanban-card'),
        ).toHaveCount(1);
        // The sub-task renders nowhere on the board.
        await expect(board.getByText(sub.text)).toHaveCount(0);
    });

    test('dragging a Ready card into Scheduled assigns the window-start date', async ({ page }) => {
        const projectName = uniq(`${MARKER} Drag schedule`);
        const start = dayISO(3);
        const project = await createProject(
            page.request,
            { name: projectName, startDate: start, dueDate: dayISO(10) },
            SERVER_URL,
        );
        const ready = await projectTask(page.request, project['tag'], { date: null });

        const board = await openBoard(page, projectName);
        const card = board.locator('.kanban-card', { hasText: ready.text });
        const scheduled = board.locator('.kanban-column[aria-label="Scheduled column"]');
        await card.dragTo(scheduled);

        // The card moved with its date input showing the project start.
        const moved = scheduled.locator('.kanban-card', { hasText: ready.text });
        await expect(moved).toBeVisible();
        await expect(moved.locator('.card-date')).toHaveValue(start);

        // The server agrees.
        const res = await page.request.get(`${SERVER_URL}/api/tasks/${ready.id}`);
        expect(((await res.json()).data as { date: string | null }).date).toBe(start);
    });

    test('dragging a Scheduled card back to Ready clears its date', async ({ page }) => {
        const projectName = uniq(`${MARKER} Drag unschedule`);
        const project = await createProject(page.request, { name: projectName }, SERVER_URL);
        const scheduledTask = await projectTask(page.request, project['tag'], {
            date: dayISO(5),
        });

        const board = await openBoard(page, projectName);
        const card = board.locator('.kanban-card', { hasText: scheduledTask.text });
        const readyColumn = board.locator('.kanban-column[aria-label="Ready column"]');
        await card.dragTo(readyColumn);

        await expect(
            readyColumn.locator('.kanban-card', { hasText: scheduledTask.text }),
        ).toBeVisible();
        const res = await page.request.get(`${SERVER_URL}/api/tasks/${scheduledTask.id}`);
        expect(((await res.json()).data as { date: string | null }).date).toBeNull();
    });

    test('dragging into Done completes the task', async ({ page }) => {
        const projectName = uniq(`${MARKER} Drag done`);
        const project = await createProject(page.request, { name: projectName }, SERVER_URL);
        const ready = await projectTask(page.request, project['tag'], { date: null });

        const board = await openBoard(page, projectName);
        const card = board.locator('.kanban-card', { hasText: ready.text });
        await card.dragTo(board.locator('.kanban-column[aria-label="Done column"]'));

        await expect(
            board.locator('.kanban-column[aria-label="Done column"] .kanban-card', {
                hasText: ready.text,
            }),
        ).toBeVisible();
        const res = await page.request.get(`${SERVER_URL}/api/tasks/${ready.id}`);
        expect(((await res.json()).data as { completed: boolean }).completed).toBe(true);
    });

    test('Auto-distribute previews the spread and applies it on confirm', async ({ page }) => {
        const projectName = uniq(`${MARKER} Distribute`);
        const start = dayISO(2);
        const project = await createProject(
            page.request,
            { name: projectName, startDate: start, dueDate: dayISO(4) },
            SERVER_URL,
        );
        const a = await projectTask(page.request, project['tag'], { date: null });
        const b = await projectTask(page.request, project['tag'], { date: null });
        const c = await projectTask(page.request, project['tag'], { date: null });

        const board = await openBoard(page, projectName);
        await board
            .getByRole('button', { name: 'Preview auto-distribution of unscheduled tasks' })
            .click();

        const preview = board.locator('.distribution-preview');
        await expect(preview).toBeVisible();
        await expect(preview.locator('.preview-row')).toHaveCount(3);

        await board.getByRole('button', { name: 'Schedule 3' }).click();
        await expect(preview).toHaveCount(0);

        // The server holds the planned spread: one task per window day.
        const dates = await Promise.all(
            [a, b, c].map(async task => {
                const res = await page.request.get(`${SERVER_URL}/api/tasks/${task.id}`);
                return ((await res.json()).data as { date: string | null }).date;
            }),
        );
        expect([...dates].sort()).toEqual([start, dayISO(3), dayISO(4)].sort());
    });

    test('Activate distributes the backlog and flips the project active', async ({ page }) => {
        const projectName = uniq(`${MARKER} Activate`);
        const start = dayISO(2);
        const project = await createProject(
            page.request,
            { name: projectName, startDate: start, dueDate: dayISO(3) },
            SERVER_URL,
        );
        const deactivate = await page.request.post(
            `${SERVER_URL}/api/projects/${project.id}/deactivate`,
            { data: {} },
        );
        expect(deactivate.status()).toBe(200);
        const a = await projectTask(page.request, project['tag'], { date: null });
        const b = await projectTask(page.request, project['tag'], { date: null });

        const board = await openBoard(page, projectName, 'inactive');
        await board.getByRole('button', { name: 'Activate', exact: true }).click();

        const confirm = modal(page, 'Confirm');
        await expect(confirm).toBeVisible();
        await confirm.getByRole('button', { name: 'Activate' }).click();

        // The project activated and the backlog spread across the window.
        // Poll the DATES, not isActive: activation flips the flag first
        // and then applies the plan task by task.
        const readDates = async (): Promise<(string | null)[]> =>
            Promise.all(
                [a, b].map(async task => {
                    const res = await page.request.get(`${SERVER_URL}/api/tasks/${task.id}`);
                    return ((await res.json()).data as { date: string | null }).date;
                }),
            );
        await expect
            .poll(async () => {
                const res = await page.request.get(`${SERVER_URL}/api/projects/${project.id}`);
                return ((await res.json()).data as { isActive: boolean }).isActive;
            })
            .toBe(true);
        await expect.poll(async () => (await readDates()).filter(d => d !== null).length).toBe(2);
        expect((await readDates()).sort()).toEqual([start, dayISO(3)].sort());
    });

    test('a blocked task shows the lock; completing the blocker clears it', async ({ page }) => {
        const projectName = uniq(`${MARKER} Lock`);
        const project = await createProject(page.request, { name: projectName }, SERVER_URL);
        const blocker = await projectTask(page.request, project['tag'], { date: null });
        const blocked = await projectTask(page.request, project['tag'], { date: null });
        await put(page.request, `/api/tasks/${blocked.id}`, { dependsOn: blocker.id }, SERVER_URL);

        const board = await openBoard(page, projectName);
        const blockedCard = board.locator('.kanban-card', { hasText: blocked.text });
        const lock = blockedCard.getByRole('button', {
            name: `Set blocked-by for ${blocked.text}`,
        });
        await expect(lock).toHaveClass(/blocked/);

        // Completing the blocker releases the lock.
        await put(page.request, `/api/tasks/${blocker.id}`, { completed: true }, SERVER_URL);
        await expect(lock).not.toHaveClass(/blocked/);
    });

    test('the blocked-by picker sets and clears the dependency', async ({ page }) => {
        const projectName = uniq(`${MARKER} Picker`);
        const project = await createProject(page.request, { name: projectName }, SERVER_URL);
        const first = await projectTask(page.request, project['tag'], { date: null });
        const second = await projectTask(page.request, project['tag'], { date: null });

        const board = await openBoard(page, projectName);
        const secondCard = board.locator('.kanban-card', { hasText: second.text });
        await secondCard.getByRole('button', { name: `Set blocked-by for ${second.text}` }).click();

        // The picker renders as the card's sibling inside the list item.
        const secondLi = board.locator('.kanban-cards li', { hasText: second.text });
        const picker = secondLi.locator('.blocked-picker select');
        await picker.selectOption({ label: first.text });
        const res = await page.request.get(`${SERVER_URL}/api/tasks/${second.id}`);
        expect(((await res.json()).data as { dependsOn: string | null }).dependsOn).toBe(first.id);

        // Clearing through the picker removes the dependency.
        await secondCard.getByRole('button', { name: `Set blocked-by for ${second.text}` }).click();
        await secondLi.locator('.blocked-picker select').selectOption({ label: '(not blocked)' });
        const after = await page.request.get(`${SERVER_URL}/api/tasks/${second.id}`);
        expect(((await after.json()).data as { dependsOn: string | null }).dependsOn).toBeNull();
    });
});
