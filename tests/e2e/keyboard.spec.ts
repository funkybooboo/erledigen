import { expect, test } from '@playwright/test';
import { cleanup, createTask, uniq } from '../api-tests/helpers';
import { hydrated, modal, SERVER_URL, todayInput, todayISO } from './util';

test.afterEach(async ({ request }) => {
    await cleanup(request, SERVER_URL);
});

/**
 * The global keyboard layer from +layout.svelte (bindings documented in
 * lib/keybindings.ts). Focus a task first (j), then act on it: Space toggles
 * completion, 1/2/3/0 set priority tags, Enter edits, e opens details, d
 * deletes, and "g <key>" chords open the rail modals.
 */
test.describe('keyboard task actions on the day list', () => {
    test('j/k move focus through day-list tasks', async ({ page }) => {
        const first = uniq('KbFirst');
        const second = uniq('KbSecond');
        for (const text of [first, second]) {
            await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        }
        await hydrated(page);

        const row = (text: string) => page.locator('.task-row', { hasText: text }).first();
        await expect(row(first)).not.toHaveClass(/focused/);

        await page.keyboard.press('j');
        await expect(row(first)).toHaveClass(/focused/);
        await expect(row(second)).not.toHaveClass(/focused/);

        await page.keyboard.press('j');
        await expect(row(second)).toHaveClass(/focused/);

        // k steps back up; clamping at the ends keeps focus on the last row.
        await page.keyboard.press('k');
        await expect(row(first)).toHaveClass(/focused/);
        await page.keyboard.press('k');
        await expect(row(first)).toHaveClass(/focused/);
    });

    test('Space toggles the focused task complete', async ({ page }) => {
        const text = uniq('KbSpace');
        const task = await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);

        const row = page.locator('.task-row', { hasText: text }).first();
        await page.keyboard.press('j');
        await expect(row).toHaveClass(/focused/);

        await page.keyboard.press('Space');
        await expect(row).toHaveClass(/completed/);
        await expect(row.getByRole('button', { name: /Mark incomplete/ })).toBeVisible();

        // And the server agrees.
        const res = await page.request.get(`${SERVER_URL}/api/tasks/${task.id}`);
        expect((await res.json()).data.completed).toBe(true);
    });

    test('1/2/3 set priority tags and 0 clears them', async ({ page }) => {
        const text = uniq('KbPriority');
        const task = await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);

        const row = page.locator('.task-row', { hasText: text }).first();
        await page.keyboard.press('j');
        await expect(row).toHaveClass(/focused/);

        await page.keyboard.press('2');
        await expect(row.locator('.tag-chip', { hasText: '#p2' })).toBeVisible();
        await expect
            .poll(async () => {
                const r = await page.request.get(`${SERVER_URL}/api/tasks/${task.id}`);
                return (await r.json()).data.tags;
            })
            .toEqual(['p2']);

        // Pressing a different priority swaps, not stacks.
        await page.keyboard.press('1');
        await expect(row.locator('.tag-chip', { hasText: '#p2' })).toHaveCount(0);
        await expect(row.locator('.tag-chip', { hasText: '#p1' })).toBeVisible();

        // 0 clears the priority tag entirely.
        await page.keyboard.press('0');
        await expect(row.locator('.tag-chip')).toHaveCount(0);
        await expect
            .poll(async () => {
                const r = await page.request.get(`${SERVER_URL}/api/tasks/${task.id}`);
                return (await r.json()).data.tags;
            })
            .toEqual([]);
    });

    test('Enter opens inline edit on the focused task, Escape cancels', async ({ page }) => {
        const text = uniq('KbEdit');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);

        await page.keyboard.press('j');
        await page.keyboard.press('Enter');
        const editInput = page.locator('.edit-input').first();
        await expect(editInput).toBeVisible();
        await expect(editInput).toHaveValue(text);

        // Escape cancels the edit; the original text is untouched.
        await page.keyboard.press('Escape');
        await expect(editInput).toHaveCount(0);
        await expect(page.locator('.task-row', { hasText: text })).toBeVisible();
    });

    test('e opens the Task Details modal for the focused task', async ({ page }) => {
        const text = uniq('KbDetail');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);

        await page.keyboard.press('j');
        await page.keyboard.press('e');
        const details = modal(page, 'Task Details');
        await expect(details).toBeVisible();
        // The task text renders as the "Task text" input's value (not text
        // content), so assert the input is prefilled with the focused task.
        await expect(details.getByLabel('Task text')).toHaveValue(text);
    });

    test('d deletes the focused task and shows the Undo notification', async ({ page }) => {
        const text = uniq('KbDelete');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);

        await page.keyboard.press('j');
        await page.keyboard.press('d');
        await expect(page.locator('.task-row', { hasText: text })).toHaveCount(0);
        const notif = page.locator('.notification', { hasText: 'Task deleted' });
        await expect(notif).toBeVisible();
    });
});

test.describe('"g <key>" navigation chords', () => {
    test('g c opens the Calendar modal, g x opens Trash', async ({ page }) => {
        await hydrated(page);
        await page.keyboard.press('g');
        await page.keyboard.press('c');
        await expect(modal(page, 'Calendar')).toBeVisible();
        await page.keyboard.press('Escape');

        await page.keyboard.press('g');
        await page.keyboard.press('x');
        await expect(modal(page, 'Trash')).toBeVisible();
    });

    test('an unrelated second key cancels the chord', async ({ page }) => {
        await hydrated(page);
        await page.keyboard.press('g');
        await page.keyboard.press('m'); // not a "go" key
        await expect(page.locator('.modal')).toHaveCount(0);

        // Keyboard shortcuts still work after the cancelled chord.
        await page.keyboard.press('?');
        await expect(modal(page, 'Keyboard Shortcuts')).toBeVisible();
    });

    test('the chord expires so a later keypress is not swallowed', async ({ page }) => {
        await hydrated(page);
        await page.keyboard.press('g');
        // The chord window is 800ms; after it lapses, "c" must type/act
        // normally instead of opening the Calendar.
        await page.waitForTimeout(1000);
        await page.keyboard.press('c');
        await expect(page.locator('.modal')).toHaveCount(0);
    });
});

test.describe('typing guards', () => {
    test('plain keys type into the add input instead of navigating', async ({ page }) => {
        await createTask(page.request, { text: uniq('KbGuard'), date: todayISO() }, SERVER_URL);
        const input = await todayInput(page);

        await page.keyboard.press('n');
        await expect(input).toBeFocused();
        await page.keyboard.press('j');
        await page.keyboard.press('k');
        await expect(input).toHaveValue('jk');
        await expect(page.locator('.task-row.focused')).toHaveCount(0);
    });

    test('Ctrl+K opens Search even while typing in the add input', async ({ page }) => {
        const input = await todayInput(page);
        await page.keyboard.press('n');
        await expect(input).toBeFocused();
        await page.keyboard.press('Control+k');
        await expect(modal(page, 'Search')).toBeVisible();
    });
});
