import { expect, test } from '@playwright/test';
import { hydrated, todayISO } from './util';

const SERVER = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://localhost:4000';
const uniq = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Habits created through the UI are not tracked by the API-test helpers,
 * so this spec cleans up after itself: habits by text prefix, plus the
 * instances they generated (deleting a habit keeps existing instances).
 */
test.afterEach(async ({ request }) => {
    const habitsRes = await request.get(`${SERVER}/api/recurring-tasks`);
    const habits = ((await habitsRes.json()).data ?? []) as Array<{
        id: string;
        text: string;
    }>;
    for (const habit of habits) {
        if (habit.text.includes('HabitE2E')) {
            await request.delete(`${SERVER}/api/recurring-tasks/${habit.id}`);
        }
    }

    const tasksRes = await request.get(`${SERVER}/api/tasks`);
    const tasks = ((await tasksRes.json()).data ?? []) as Array<{
        id: string;
        text: string;
    }>;
    for (const task of tasks) {
        if (task.text.includes('HabitE2E')) {
            await request.delete(`${SERVER}/api/tasks/${task.id}`);
        }
    }
});

async function todayInput(page: import('@playwright/test').Page) {
    await hydrated(page);
    return page.locator('.day-section.today .add-input');
}

test.describe('natural-language habits from the inline input', () => {
    test('"every other day" creates a habit and materializes today\'s instance', async ({
        page,
    }) => {
        const text = uniq('HabitE2E Water fern');
        const input = await todayInput(page);

        // The live hint appears while typing the recurrence phrase.
        await input.fill(`${text} every other day`);
        await expect(page.locator('.recur-hint')).toHaveText(/Every other day/);

        await input.press('Enter');

        // A notification confirms the habit was created (4s auto-dismiss,
        // so assert it first — before waiting on the instance render).
        await expect(page.getByText('Habit created — Every other day')).toBeVisible({
            timeout: 3000,
        });

        // Today's instance renders immediately (generated via HTTP and ingested).
        await expect(page.locator('.day-section.today').getByText(text)).toBeVisible();

        // The hint is gone and the input is cleared.
        await expect(page.locator('.recur-hint')).toHaveCount(0);
        await expect(input).toHaveValue('');

        // The habit exists on the server with the parsed schedule.
        const res = await page.request.get(`${SERVER}/api/recurring-tasks`);
        const habits = (await res.json()).data as Array<{
            text: string;
            frequency: string;
            interval: number;
        }>;
        const habit = habits.find(h => h.text === text);
        expect(habit).toBeDefined();
        expect(habit?.frequency).toBe('daily');
        expect(habit?.interval).toBe(2);
    });

    test('"every friday at 4:00pm" parses weekday and time', async ({ page, request }) => {
        const text = uniq('HabitE2E Deploy');
        const input = await todayInput(page);

        await input.fill(`${text} every friday at 4:00pm`);
        await expect(page.locator('.recur-hint')).toHaveText(/Every Friday at 4:00pm/);
        await input.press('Enter');

        // Even when today is not a Friday, the habit exists with the right
        // schedule (no instance today is expected).
        const res = await request.get(`${SERVER}/api/recurring-tasks`);
        const habits = (await res.json()).data as Array<{
            text: string;
            dayOfWeek: number | null;
            startTime: string | null;
        }>;
        const habit = habits.find(h => h.text === text);
        expect(habit?.dayOfWeek).toBe(5);
        expect(habit?.startTime).toBe('16:00');
    });

    test('generate-all is idempotent — no duplicate instances', async ({ request }) => {
        const text = uniq('HabitE2E Idempotent');
        const createRes = await request.post(`${SERVER}/api/recurring-tasks`, {
            data: {
                text,
                frequency: 'daily',
                startDate: todayISO(),
            },
        });
        expect(createRes.status()).toBe(201);
        const habit = (await createRes.json()).data as { id: string };

        const first = await request.post(`${SERVER}/api/recurring-tasks/generate-all`, {
            data: { startDate: todayISO(), endDate: todayISO() },
        });
        const firstBody = (await first.json()).data as Array<{ recurringTaskId: string }>;
        expect(firstBody.some(g => g.recurringTaskId === habit.id)).toBe(true);

        const second = await request.post(`${SERVER}/api/recurring-tasks/generate-all`, {
            data: { startDate: todayISO(), endDate: todayISO() },
        });
        const secondBody = (await second.json()).data as Array<{ recurringTaskId: string }>;
        expect(secondBody.some(g => g.recurringTaskId === habit.id)).toBe(false);
    });
});

test.describe('habits modal management', () => {
    test('create, edit, and delete a habit from the modal', async ({ page }) => {
        await hydrated(page);
        await page.getByLabel('Habits', { exact: true }).click();

        const dialog = page.getByRole('dialog', { name: 'Habits', exact: true });
        await expect(dialog).toBeVisible();

        // Create via the form — typing a recurrence phrase prefills the schedule.
        const text = uniq('HabitE2E Stretch');
        await dialog.getByLabel('New habit').click();
        await dialog.getByLabel('Habit name').fill(`${text} every day at 7am`);
        await expect(dialog.locator('.recur-hint')).toHaveText(/Every day at 7:00am/);
        // The phrase preselected "Daily" via the live parse.
        await expect(dialog.getByLabel('Repeats')).toHaveValue('daily');
        await dialog.getByRole('button', { name: 'Create' }).click();

        // The habit card lists the human-readable schedule.
        const card = dialog.locator('.habit-card', { hasText: text });
        await expect(card).toBeVisible();
        await expect(card.locator('.habit-freq')).toHaveText('Every day at 7:00am');

        // Edit: change the schedule via the form.
        await card.getByLabel('Edit habit').click();
        await dialog.getByLabel('Habit name').fill(`${text} every week`);
        await dialog.getByRole('button', { name: 'Save' }).click();
        await expect(card.locator('.habit-freq')).toHaveText('Every week');

        // Delete (default deleteConfirmation setting deletes immediately).
        await card.getByLabel('Delete habit').click();
        await expect(card).toHaveCount(0);
    });
});
