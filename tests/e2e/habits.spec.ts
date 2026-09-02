import { expect, test } from '@playwright/test';
import { uniq } from '../api-tests/helpers';
import { hydrated, SERVER_URL, todayInput, todayISO } from './util';

/**
 * Habits created through the UI are not tracked by the API-test helpers,
 * so this spec cleans up after itself: habits by text prefix, plus the
 * instances they generated (deleting a habit keeps existing instances).
 */
test.afterEach(async ({ request }) => {
    const habitsRes = await request.get(`${SERVER_URL}/api/recurring-tasks`);
    const habits = ((await habitsRes.json()).data ?? []) as Array<{
        id: string;
        text: string;
    }>;
    for (const habit of habits) {
        if (habit.text.includes('HabitE2E')) {
            await request.delete(`${SERVER_URL}/api/recurring-tasks/${habit.id}`);
        }
    }

    const tasksRes = await request.get(`${SERVER_URL}/api/tasks`);
    const tasks = ((await tasksRes.json()).data ?? []) as Array<{
        id: string;
        text: string;
    }>;
    for (const task of tasks) {
        if (task.text.includes('HabitE2E')) {
            await request.delete(`${SERVER_URL}/api/tasks/${task.id}`);
        }
    }
});

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
        // so assert it first -- before waiting on the instance render).
        await expect(page.getByText('Habit created -- Every other day')).toBeVisible({
            timeout: 3000,
        });

        // Today's instance renders immediately (generated via HTTP and ingested).
        await expect(page.locator('.day-section.today').getByText(text)).toBeVisible();

        // The hint is gone and the input is cleared.
        await expect(page.locator('.recur-hint')).toHaveCount(0);
        await expect(input).toHaveValue('');

        // The habit exists on the server with the parsed schedule.
        const res = await page.request.get(`${SERVER_URL}/api/recurring-tasks`);
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

        // Wait for the app-visible creation signal before reading server
        // state -- press() returns before the async submit handler's POST
        // completes, so fetching immediately races the create.
        await expect(page.getByText('Habit created --')).toBeVisible({ timeout: 3000 });

        // Even when today is not a Friday, the habit exists with the right
        // schedule (no instance today is expected).
        const res = await request.get(`${SERVER_URL}/api/recurring-tasks`);
        const habits = (await res.json()).data as Array<{
            text: string;
            daysOfWeek: number[] | null;
            startTime: string | null;
        }>;
        const habit = habits.find(h => h.text === text);
        expect(habit?.daysOfWeek).toEqual([5]);
        expect(habit?.startTime).toBe('16:00');
    });

    test('generate-all is idempotent -- no duplicate instances', async ({ request }) => {
        const text = uniq('HabitE2E Idempotent');
        const createRes = await request.post(`${SERVER_URL}/api/recurring-tasks`, {
            data: {
                text,
                frequency: 'daily',
                startDate: todayISO(),
            },
        });
        expect(createRes.status()).toBe(201);
        const habit = (await createRes.json()).data as { id: string };

        const first = await request.post(`${SERVER_URL}/api/recurring-tasks/generate-all`, {
            data: { startDate: todayISO(), endDate: todayISO() },
        });
        const firstBody = (await first.json()).data as Array<{ recurringTaskId: string }>;
        expect(firstBody.some(g => g.recurringTaskId === habit.id)).toBe(true);

        const second = await request.post(`${SERVER_URL}/api/recurring-tasks/generate-all`, {
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

        // Create via the form -- typing a recurrence phrase prefills the schedule.
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

test.describe('weekday and weekend habits', () => {
    test('"every weekday" creates a Mon-Fri habit', async ({ page, request }) => {
        const text = uniq('HabitE2E WeekdayGym');
        const input = await todayInput(page);

        await input.fill(`${text} every weekday`);
        await expect(page.locator('.recur-hint')).toHaveText(/Weekdays/);
        await input.press('Enter');

        await expect(page.getByText('Habit created -- Weekdays')).toBeVisible({ timeout: 3000 });

        const res = await request.get(`${SERVER_URL}/api/recurring-tasks`);
        const habits = (await res.json()).data as Array<{
            text: string;
            frequency: string;
            daysOfWeek: number[] | null;
        }>;
        const habit = habits.find(h => h.text === text);
        expect(habit?.frequency).toBe('daily');
        expect(habit?.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
    });

    test('"every weekend" creates a Sat-Sun habit', async ({ page, request }) => {
        const text = uniq('HabitE2E WeekendBrunch');
        const input = await todayInput(page);

        await input.fill(`${text} every weekend`);
        await expect(page.locator('.recur-hint')).toHaveText(/Weekends/);
        await input.press('Enter');

        await expect(page.getByText('Habit created -- Weekends')).toBeVisible({ timeout: 3000 });

        const res = await request.get(`${SERVER_URL}/api/recurring-tasks`);
        const habits = (await res.json()).data as Array<{
            text: string;
            daysOfWeek: number[] | null;
        }>;
        const habit = habits.find(h => h.text === text);
        expect(habit?.daysOfWeek).toEqual([0, 6]);
    });
});

test.describe('streak stats', () => {
    test('completing an instance shows a streak in the Habits modal', async ({
        page,
        request,
    }) => {
        const text = uniq('HabitE2E Streaky');
        const today = todayISO();

        // Create the habit + today's instance and complete it, straight
        // through the API (the UI paths are covered above).
        const createRes = await request.post(`${SERVER_URL}/api/recurring-tasks`, {
            data: { text, frequency: 'daily', startDate: today },
        });
        expect(createRes.status()).toBe(201);
        const habit = (await createRes.json()).data as { id: string };

        const gen = await request.post(`${SERVER_URL}/api/recurring-tasks/${habit.id}/generate`, {
            data: { startDate: today, endDate: today },
        });
        const instances = (await gen.json()).data as Array<{ id: string }>;
        expect(instances).toHaveLength(1);

        const complete = await request.put(`${SERVER_URL}/api/tasks/${instances[0]?.id}`, {
            data: { completed: true },
        });
        expect(complete.status()).toBe(200);

        // The stats endpoint reflects the completed instance.
        const statsRes = await request.get(`${SERVER_URL}/api/recurring-tasks/${habit.id}/stats`);
        expect((await statsRes.json()).data.currentStreak).toBe(1);

        // The Habits modal renders the streak badge.
        await hydrated(page);
        await page.getByLabel('Habits', { exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Habits', exact: true });
        const card = dialog.locator('.habit-card', { hasText: text });
        await expect(card).toBeVisible();
        await expect(card.locator('[data-testid="habit-streak"]')).toHaveText('1');
        await expect(card.locator('.meta-stat', { hasText: '1 done' })).toBeVisible();
        await expect(card.locator('.meta-stat', { hasText: `last ${today}` })).toBeVisible();
    });
});

test.describe('command palette /add', () => {
    test('"/add <text> every day" creates a habit from the palette', async ({
        page,
        request,
    }) => {
        const text = uniq('HabitE2E PalRead');
        await hydrated(page);

        await page.keyboard.press('/');
        const search = page.getByRole('dialog', { name: 'Search', exact: true });
        await expect(search).toBeVisible();

        // Typing the command shows the /add row with a live habit hint.
        await search.getByLabel('Search tasks').fill(`/add ${text} every day`);
        await expect(search.locator('.result-item', { hasText: `Add: ${text}` })).toBeVisible();
        await expect(search.locator('.command-hint')).toHaveText(/Every day/);

        await search.getByLabel('Search tasks').press('Enter');

        // The modal closes and the habit is confirmed + materialized.
        await expect(search).toBeHidden();
        await expect(page.getByText('Habit created -- Every day')).toBeVisible({ timeout: 3000 });
        await expect(page.locator('.day-section.today').getByText(text)).toBeVisible();

        const res = await request.get(`${SERVER_URL}/api/recurring-tasks`);
        const habits = (await res.json()).data as Array<{ text: string }>;
        expect(habits.some(h => h.text === text)).toBe(true);
    });
});
