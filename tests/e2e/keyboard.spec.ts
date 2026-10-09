import { expect, test } from '@playwright/test';
import { cleanup, createTask, uniq } from '../api-tests/helpers';
import { dayISO, hydrated, modal, SERVER_URL, todayInput, todayISO } from './util';

test.afterEach(async ({ request }) => {
    await cleanup(request, SERVER_URL);
});

/**
 * The global keyboard layer from +layout.svelte (bindings documented in
 * lib/keybindings.ts). Tests act on the FOCUSED task: clicking a row's
 * checkbox focuses it (so tests are immune to foreign tasks earlier in the
 * list), then Space toggles completion, 1/2/3/0 set priority tags, Enter
 * edits, e opens details, d deletes, and "g <key>" chords open the modals.
 *
 * Every test waits for its seeded rows to render before pressing keys:
 * hydration (data-hydrated) only means handlers are live -- the task list
 * fetch may still be in flight, and acting before it lands silently no-ops.
 */
test.describe('keyboard task actions on the day list', () => {
    /** The row for a seeded task text. */
    const row = (page: import('@playwright/test').Page, text: string) =>
        page.locator('.task-row', { hasText: text }).first();

    /** Focus a row by clicking its checkbox (rows focus on their actions). */
    async function focusRow(page: import('@playwright/test').Page, text: string) {
        const target = row(page, text);
        await expect(target).toBeVisible();
        await target.getByRole('button', { name: /Mark (in)?complete/ }).click();
        await expect(target).toHaveClass(/focused/);
        return target;
    }

    test('j/k move focus through day-list tasks', async ({ page }) => {
        const first = uniq('KbFirst');
        const second = uniq('KbSecond');
        for (const text of [first, second]) {
            await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        }
        await hydrated(page);

        // Focus the first seed, then j/k step between the two (the seeds are
        // adjacent in creation order, so movement is deterministic even if
        // foreign tasks exist earlier in the list).
        await focusRow(page, first);
        await page.keyboard.press('j');
        await expect(row(page, second)).toHaveClass(/focused/);
        await expect(row(page, first)).not.toHaveClass(/focused/);

        await page.keyboard.press('k');
        await expect(row(page, first)).toHaveClass(/focused/);

        // k clamps at the top: focus stays on the first seed.
        await page.keyboard.press('k');
        await expect(row(page, first)).toHaveClass(/focused/);
    });

    test('Space toggles the focused task complete', async ({ page }) => {
        const text = uniq('KbSpace');
        const task = await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);

        // Clicking the checkbox to focus also completes the task; Space then
        // flips it back -- both directions of the toggle in one test.
        const target = await focusRow(page, text);
        await expect(target).toHaveClass(/completed/);

        await page.keyboard.press('Space');
        await expect(target).not.toHaveClass(/completed/);
        await expect(target.getByRole('button', { name: /Mark complete/ })).toBeVisible();

        // And the server agrees.
        const res = await page.request.get(`${SERVER_URL}/api/tasks/${task.id}`);
        expect((await res.json()).data.completed).toBe(false);
    });

    test('1/2/3 set priority tags and 0 clears them', async ({ page }) => {
        const text = uniq('KbPriority');
        const task = await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);

        const target = await focusRow(page, text);

        await page.keyboard.press('2');
        await expect(target.locator('.tag-chip', { hasText: '#p2' })).toBeVisible();
        await expect
            .poll(async () => {
                const r = await page.request.get(`${SERVER_URL}/api/tasks/${task.id}`);
                return (await r.json()).data.tags;
            })
            .toEqual(['p2']);

        // Pressing a different priority swaps, not stacks.
        await page.keyboard.press('1');
        await expect(target.locator('.tag-chip', { hasText: '#p2' })).toHaveCount(0);
        await expect(target.locator('.tag-chip', { hasText: '#p1' })).toBeVisible();

        // 0 clears the priority tag entirely.
        await page.keyboard.press('0');
        await expect(target.locator('.tag-chip')).toHaveCount(0);
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

        await focusRow(page, text);
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

        await focusRow(page, text);
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

        await focusRow(page, text);
        await page.keyboard.press('d');
        await expect(page.locator('.task-row', { hasText: text })).toHaveCount(0);
        const notif = page.locator('.notification', { hasText: 'Task deleted' });
        await expect(notif).toBeVisible();
    });

    test('J/K jump focus between day sections', async ({ page }) => {
        const todayText = uniq('KbJumpToday');
        const tomorrowText = uniq('KbJumpTomorrow');
        await createTask(page.request, { text: todayText, date: todayISO() }, SERVER_URL);
        await createTask(page.request, { text: tomorrowText, date: dayISO(1) }, SERVER_URL);
        await hydrated(page);

        // Focus today's seed, then J lands on tomorrow's first task.
        await focusRow(page, todayText);
        await page.keyboard.press('J');
        await expect(row(page, tomorrowText)).toHaveClass(/focused/);
        await expect(row(page, todayText)).not.toHaveClass(/focused/);

        // K jumps back to the previous section (today's first task).
        await page.keyboard.press('K');
        await expect(row(page, todayText)).toHaveClass(/focused/);
    });

    test('r opens the inline reschedule editor and moves the task', async ({ page }) => {
        const text = uniq('KbReschedule');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);

        await focusRow(page, text);
        await page.keyboard.press('r');
        const dateInput = page.getByLabel('Reschedule task');
        await expect(dateInput).toBeVisible();
        await expect(dateInput).toHaveValue(todayISO());

        await dateInput.fill('tomorrow');
        await dateInput.press('Enter');
        await expect(dateInput).toHaveCount(0);
        // The task moved to tomorrow's section.
        await expect(page.locator(`section#day-${dayISO(1)}`).getByText(text)).toBeVisible();
        await expect(page.locator(`section#day-${todayISO()}`).getByText(text)).toHaveCount(0);
    });

    test('an unparseable reschedule date announces the failure through the live region', async ({
        page,
    }) => {
        const text = uniq('KbRescheduleFail');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);

        await focusRow(page, text);
        await page.keyboard.press('r');
        const dateInput = page.getByLabel('Reschedule task');
        await dateInput.fill('not a date');
        await dateInput.press('Enter');

        // The failure lands in the aria-live notification region
        // (role=status), so assistive tech hears it (USE-12) -- and the
        // task stays on today.
        await expect(page.getByRole('status').filter({ hasText: 'Could not parse' })).toBeVisible();
        await expect(page.locator(`section#day-${todayISO()}`).getByText(text)).toBeVisible();
    });

    test('t opens the inline tags editor on the focused task', async ({ page }) => {
        const text = uniq('KbTags');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await hydrated(page);

        await focusRow(page, text);
        await page.keyboard.press('t');
        const tagsInput = page.getByLabel('Edit task tags');
        await expect(tagsInput).toBeVisible();

        await tagsInput.fill('urgent, focus');
        await tagsInput.press('Enter');
        await expect(tagsInput).toHaveCount(0);
        const target = row(page, text);
        await expect(target.locator('.tag-chip', { hasText: 'urgent' })).toBeVisible();
        await expect(target.locator('.tag-chip', { hasText: 'focus' })).toBeVisible();
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
        const text = uniq('KbGuard');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        const input = await todayInput(page);

        // Wait for the seeded task to render: the initial fetch re-renders
        // the day list, and focusing the input before that would race the
        // re-render and lose focus.
        await expect(page.locator('.task-row', { hasText: text })).toBeVisible();

        await page.keyboard.press('n');
        await expect(input).toBeFocused();
        await page.keyboard.press('j');
        await page.keyboard.press('k');
        await expect(input).toHaveValue('jk');
        await expect(page.locator('.task-row.focused')).toHaveCount(0);
    });

    test('Ctrl+K opens Search even while typing in the add input', async ({ page }) => {
        const text = uniq('KbModSearch');
        await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        const input = await todayInput(page);
        await expect(page.locator('.task-row', { hasText: text })).toBeVisible();

        await page.keyboard.press('n');
        await expect(input).toBeFocused();
        await page.keyboard.press('Control+k');
        await expect(modal(page, 'Search')).toBeVisible();
    });
});
