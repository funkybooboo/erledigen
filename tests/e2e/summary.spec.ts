import { expect, test } from '@playwright/test';
import { cleanup, createHoliday, createRecurring, createTask, uniq } from '../api-tests/helpers';
import { dayISO, hydrated, modal, SERVER_URL, todayISO } from './util';

/**
 * Summary-modal section tests (v0.9.0). Seeded through the API; the
 * marker prefix lets the hand-rolled habit/instance cleanup find what
 * the tracked-entity cleanup cannot (generated instances survive their
 * template's deletion).
 */

const MARKER = 'SummaryE2E';

test.afterEach(async ({ request }) => {
    // Tracked entities (tasks, holidays, recurring templates) first.
    await cleanup(request, SERVER_URL);

    // The habit's generated instances are hand-rolled cleanup (deleting a
    // habit keeps its instances).
    const tasksRes = await request.get(`${SERVER_URL}/api/tasks`);
    const tasks = ((await tasksRes.json()).data ?? []) as Array<{
        id: string;
        text: string;
    }>;
    for (const task of tasks) {
        if (task.text.includes(MARKER)) {
            await request.delete(`${SERVER_URL}/api/tasks/${task.id}`).catch(() => {});
        }
    }
    const habitsRes = await request.get(`${SERVER_URL}/api/recurring-tasks`);
    const habits = ((await habitsRes.json()).data ?? []) as Array<{
        id: string;
        text: string;
    }>;
    for (const habit of habits) {
        if (habit.text.includes(MARKER)) {
            await request.delete(`${SERVER_URL}/api/recurring-tasks/${habit.id}`).catch(() => {});
        }
    }
});

/** Open the Summary modal and return its dialog locator. */
async function openSummary(page: import('@playwright/test').Page) {
    await hydrated(page);
    await page.getByRole('button', { name: 'Summary', exact: true }).click();
    const summary = modal(page, 'Summary');
    await expect(summary).toBeVisible();
    return summary;
}

/** Clear everything the Summary sections read: holidays, habits (with
 *  their instances -- deleting a template keeps them), and any task that
 *  would surface as overdue or as an upcoming deadline. On CI's fresh
 *  per-suite server this is a near-no-op; a long-lived local test
 *  server holds leftovers that would otherwise leak into the empty-
 *  state assertions. */
async function wipeSummaryState(request: import('@playwright/test').APIRequestContext) {
    const holidays = await request.get(`${SERVER_URL}/api/holidays`);
    for (const holiday of ((await holidays.json()).data ?? []) as Array<{ id: string }>) {
        await request.delete(`${SERVER_URL}/api/holidays/${holiday.id}`).catch(() => {});
    }

    const habits = await request.get(`${SERVER_URL}/api/recurring-tasks`);
    for (const habit of ((await habits.json()).data ?? []) as Array<{ id: string }>) {
        await request.delete(`${SERVER_URL}/api/recurring-tasks/${habit.id}`).catch(() => {});
        const instances = await request.get(`${SERVER_URL}/api/tasks`);
        for (const task of ((await instances.json()).data ?? []) as Array<{
            id: string;
            recurringTaskId: string | null;
        }>) {
            if (task.recurringTaskId === habit.id) {
                await request.delete(`${SERVER_URL}/api/tasks/${task.id}`).catch(() => {});
            }
        }
    }

    const tasks = await request.get(`${SERVER_URL}/api/tasks`);
    for (const task of ((await tasks.json()).data ?? []) as Array<{
        id: string;
        date: string | null;
        tags: string[];
    }>) {
        const pollutes =
            (task.date !== null && task.date < todayISO()) || task.tags.includes('deadline');
        if (pollutes) {
            await request.delete(`${SERVER_URL}/api/tasks/${task.id}`).catch(() => {});
        }
    }
}

test.describe('Summary modal', () => {
    test('with nothing seeded, only the Today section renders', async ({ page }) => {
        await wipeSummaryState(page.request);
        const summary = await openSummary(page);
        await expect(summary.getByRole('heading', { name: 'Today' })).toBeVisible();
        await expect(summary.getByRole('heading', { name: /Overdue/ })).toHaveCount(0);
        await expect(summary.getByRole('heading', { name: 'Active Streaks' })).toHaveCount(0);
        await expect(summary.getByRole('heading', { name: 'Next 14 Days' })).toHaveCount(0);
    });

    test('an incomplete past-dated task renders as overdue with a days-late badge', async ({
        page,
    }) => {
        const overdueText = uniq(`${MARKER} Overdue`);
        const doneText = uniq(`${MARKER} Done old`);
        await createTask(page.request, { text: overdueText, date: dayISO(-3) }, SERVER_URL);
        // The public create schema strips `completed` (ADR-009) -- complete
        // through the PUT update path instead.
        const doneTask = await createTask(
            page.request,
            { text: doneText, date: dayISO(-3) },
            SERVER_URL,
        );
        await page.request.put(`${SERVER_URL}/api/tasks/${doneTask.id}`, {
            data: { completed: true },
        });

        const summary = await openSummary(page);
        await expect(summary.getByRole('heading', { name: /Overdue \(1\)/ })).toBeVisible();
        const row = summary.locator('.list-item', { hasText: overdueText });
        await expect(row).toBeVisible();
        await expect(row.locator('.overdue-badge')).toHaveText('3 days late');
        // Completed past tasks do not count as overdue.
        await expect(summary.locator('.list-item', { hasText: doneText })).toHaveCount(0);
    });

    test('#deadline tasks and holidays within 14 days land in Next 14 Days', async ({ page }) => {
        const deadlineText = uniq(`${MARKER} Deadline`);
        const holidayName = uniq(`${MARKER} Holiday`);
        const farText = uniq(`${MARKER} Far deadline`);
        await createTask(
            page.request,
            { text: deadlineText, date: dayISO(5), tags: ['deadline'] },
            SERVER_URL,
        );
        await createHoliday(page.request, { name: holidayName, date: dayISO(7) }, SERVER_URL);
        // A #deadline task beyond the window stays out.
        await createTask(
            page.request,
            { text: farText, date: dayISO(30), tags: ['deadline'] },
            SERVER_URL,
        );

        const summary = await openSummary(page);
        await expect(summary.getByRole('heading', { name: 'Next 14 Days' })).toBeVisible();
        await expect(summary.locator('.list-item', { hasText: deadlineText })).toBeVisible();
        const holidayRow = summary.locator('.list-item', { hasText: holidayName });
        await expect(holidayRow).toBeVisible();
        await expect(holidayRow.locator('.holiday-badge')).toHaveText(dayISO(7));
        await expect(summary.locator('.list-item', { hasText: farText })).toHaveCount(0);
    });

    test('a habit with completed instances renders its active streak', async ({ page }) => {
        const habitText = uniq(`${MARKER} Streak habit`);
        // startDate = the first recurrence date we complete: a habit
        // starting earlier would let the day list materialize an earlier
        // incomplete instance on page load (habits generate on demand),
        // which would surface in the Overdue section and break the
        // strict row lookup.
        const habit = await createRecurring(
            page.request,
            { text: habitText, frequency: 'daily', startDate: dayISO(-1) },
            SERVER_URL,
        );

        // Yesterday and today, completed -- a current streak of 2.
        const gen = await page.request.post(
            `${SERVER_URL}/api/recurring-tasks/${habit.id}/generate`,
            { data: { startDate: dayISO(-1), endDate: todayISO() } },
        );
        expect(gen.status()).toBe(200);
        const instances = ((await gen.json()).data ?? []) as Array<{ id: string; date: string }>;
        expect(instances.length).toBe(2);
        for (const instance of instances) {
            const res = await page.request.put(`${SERVER_URL}/api/tasks/${instance.id}`, {
                data: { completed: true },
            });
            expect(res.status()).toBe(200);
        }

        const summary = await openSummary(page);
        await expect(summary.getByRole('heading', { name: 'Active Streaks' })).toBeVisible();
        const row = summary.locator('.list-item', { hasText: habitText });
        await expect(row).toBeVisible();
        await expect(row.locator('.streak-badge')).toHaveText('2 days');
    });
});
