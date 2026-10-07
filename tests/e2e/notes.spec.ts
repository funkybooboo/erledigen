/**
 * Notes e2e (v0.10.0): live markdown everywhere + day notes + the
 * Notes modal lens.
 *
 * Seeding goes through the API (SERVER_URL) like the other suites; the
 * day-list day-note surface and the modal are exercised in the browser.
 */

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { cleanup, createTask, track, uniq } from '../api-tests/helpers';
import { dayISO, hydrated, modal, SERVER_URL, todayISO } from './util';

test.afterEach(async ({ request }) => {
    await cleanup(request, SERVER_URL);
});

/** PUT a day note through the API (tracked for cleanup by date). */
async function putDayNote(page: Page, date: string, notes: string): Promise<void> {
    const res = await page.request.put(`${SERVER_URL}/api/day-notes/${date}`, { data: { notes } });
    expect(res.status()).toBe(200);
    track('dayNote', date, SERVER_URL);
}

test.describe('live markdown -- task titles', () => {
    test('a markdown title renders and its raw text opens for editing', async ({ page }) => {
        const text = uniq('markdown-title');
        const task = await createTask(
            page.request,
            { text: `**${text}**`, date: todayISO() },
            SERVER_URL,
        );

        await hydrated(page);
        const section = page.locator(`#day-${todayISO()}`);
        const row = section.locator(`#task-${task.id}`);

        // Rendered: the strong tag wraps the text...
        await expect(row.locator('.title-markdown strong')).toHaveText(text);

        // ...and the accessible name stays the RAW source (what the user
        // actually wrote is the truth).
        await expect(row.locator('.task-text')).toHaveAccessibleName(`**${text}**`);

        // Clicking the title opens the raw syntax for editing (the live
        // model: the line under the caret shows source).
        await row.locator('.task-text').click();
        await expect(row.locator('.edit-input')).toHaveValue(`**${text}**`);
    });

    test('a heading title renders as a bold section-style line', async ({ page }) => {
        const task = await createTask(
            page.request,
            { text: '# Morning block', date: todayISO() },
            SERVER_URL,
        );
        await hydrated(page);
        const heading = page.locator(`#task-${task.id} .title-markdown h1`);
        await expect(heading).toHaveText('Morning block');
    });
});

test.describe('live markdown -- task notes', () => {
    test('the has-notes indicator marks tasks carrying notes', async ({ page }) => {
        const withNotes = uniq('noted-task');
        const bare = uniq('bare-task');
        const noted = await createTask(
            page.request,
            { text: withNotes, date: todayISO() },
            SERVER_URL,
        );
        await createTask(page.request, { text: bare, date: todayISO() }, SERVER_URL);
        await page.request.put(`${SERVER_URL}/api/tasks/${noted.id}`, {
            data: { notes: 'a note lives here' },
        });

        await hydrated(page);
        await expect(page.locator(`#task-${noted.id} .has-notes`)).toBeVisible();
        // The plain task carries no indicator.
        const bareRow = page.locator('.day-section.today .task-row').filter({
            hasText: bare,
        });
        await expect(bareRow.locator('.has-notes')).toHaveCount(0);
    });

    test('notes render as markdown in the detail modal and the edited line shows raw syntax', async ({
        page,
    }) => {
        const text = uniq('detail-notes');
        const task = await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await page.request.put(`${SERVER_URL}/api/tasks/${task.id}`, {
            data: { notes: '# Day plan\n\n- water **the basil**' },
        });

        await hydrated(page);
        await page.locator(`#task-${task.id} .action-btn[aria-label="Task details"]`).click();
        const detail = modal(page, 'Task Details');
        await expect(detail).toBeVisible();

        // Idle: rendered markdown.
        await expect(detail.locator('.notes-editor h1')).toHaveText('Day plan');
        await expect(detail.locator('.notes-editor li')).toHaveCount(1);

        // Click the heading: only that line drops back to raw syntax.
        await detail.locator('.notes-editor h1').click();
        const rawLine = detail.locator('textarea.md-line-input');
        await expect(rawLine).toHaveValue('# Day plan');
        // The other lines stay rendered while the caret line is raw.
        await expect(detail.locator('.notes-editor li')).toHaveCount(1);

        // Esc settles the edit back to rendered markdown.
        await page.keyboard.press('Escape');
        await expect(detail.locator('textarea.md-line-input')).toHaveCount(0);
        await expect(detail.locator('.notes-editor h1')).toHaveText('Day plan');
    });
});

test.describe('day notes -- the calendar margin', () => {
    test('a day with no note shows the quiet affordance, and writing saves it', async ({
        page,
    }) => {
        await hydrated(page);
        const today = page.locator(`#day-${todayISO()}`);
        const affordance = today.locator('.day-note-affordance');
        await expect(affordance).toBeVisible();

        // One click jumps straight into the raw line.
        await affordance.click();
        const raw = today.locator('textarea.md-line-input');
        await expect(raw).toBeFocused();
        await page.keyboard.type('# Margin jot');
        await page.keyboard.press('Enter');
        await page.keyboard.type('- first line');
        await page.keyboard.press('Escape');

        // Debounced save: the note renders immediately (local state) and
        // persists after the commit window.
        await expect(today.locator('.day-note h1')).toHaveText('Margin jot');
        await expect
            .poll(async () => {
                const res = await page.request.get(`${SERVER_URL}/api/day-notes/${todayISO()}`);
                return res.ok() ? (await res.json()).data.notes : null;
            })
            .toBe('# Margin jot\n- first line');

        // The note was created through the UI, not the API -- it is not
        // in the tracked cleanup set, so remove it explicitly (leaving
        // it breaks the modal's empty-state test below).
        await page.request.delete(`${SERVER_URL}/api/day-notes/${todayISO()}`);
    });

    test('a day note seeded through the API renders live (WS broadcast)', async ({ page }) => {
        const date = dayISO(3);
        const notes = '# Seeded note\n\n- from another tab';
        await hydrated(page);
        const section = page.locator(`#day-${date}`);
        await section.scrollIntoViewIfNeeded();
        await expect(section.locator('.day-note h1')).toHaveCount(0);

        await putDayNote(page, date, notes);

        // Only the dayNote:created broadcast can render it without a reload.
        await expect(section.locator('.day-note h1')).toHaveText('Seeded note');
        await expect(section.locator('.day-note .md-item-text')).toHaveText('from another tab');
    });

    test('clearing the note deletes it and the affordance returns', async ({ page }) => {
        const date = dayISO(4);
        await putDayNote(page, date, 'temporary margin note');
        await hydrated(page);
        const section = page.locator(`#day-${date}`);
        await section.scrollIntoViewIfNeeded();
        await expect(section.locator('.day-note p')).toHaveText('temporary margin note');

        // Click the rendered note -> raw line -> clear it -> Esc.
        await section.locator('.day-note .md-root p').click();
        const raw = section.locator('textarea.md-line-input');
        await expect(raw).toBeFocused();
        await raw.fill('');
        await page.keyboard.press('Escape');

        // The debounced empty commit DELETEs the row; the affordance
        // is back and the server answers 404.
        await expect(section.locator('.day-note-affordance')).toBeVisible({ timeout: 5000 });
        await expect
            .poll(async () => {
                const res = await page.request.get(`${SERVER_URL}/api/day-notes/${date}`);
                return res.status();
            })
            .toBe(404);
    });
});

test.describe('the Notes modal -- a lens over every note', () => {
    test('groups day notes and task notes by owner, edits in place, hops back', async ({
        page,
    }) => {
        const date = dayISO(5);
        const taskText = uniq('modal-note-task');
        const task = await createTask(page.request, { text: taskText, date }, SERVER_URL);
        await page.request.put(`${SERVER_URL}/api/tasks/${task.id}`, {
            data: { notes: 'the attached task note' },
        });
        await putDayNote(page, date, 'the margin entry');

        await hydrated(page);
        // g n opens the Notes modal.
        await page.keyboard.press('g');
        await page.keyboard.press('n');
        const notesModal = modal(page, 'Notes');
        await expect(notesModal).toBeVisible();

        // The day group carries both entries: the day note and the
        // task note under its task.
        const groupWithEntries = notesModal
            .locator('.day-group')
            .filter({ hasText: taskText })
            .first();
        await expect(groupWithEntries.locator('.day-note-entry .day-note p')).toHaveText(
            'the margin entry',
        );
        await expect(groupWithEntries.locator('.owner-text')).toHaveText(taskText);

        // Edit the task note in place: click its rendered note, type,
        // Esc; the task's note is updated on the server.
        const taskEntry = notesModal.locator('.entry').filter({ hasText: taskText });
        await taskEntry.locator('.md-root p').click();
        const raw = taskEntry.locator('textarea.md-line-input');
        await raw.fill('the edited task note');
        await page.keyboard.press('Escape');
        await expect
            .poll(async () => {
                const res = await (
                    await page.request.get(`${SERVER_URL}/api/tasks/${task.id}`)
                ).json();
                return res.data.notes;
            })
            .toBe('the edited task note');

        // Hop back: the task hop opens the detail modal for that task.
        await taskEntry.locator('.hop-btn').click();
        const detail = modal(page, 'Task Details');
        await expect(detail).toBeVisible();
        await expect(detail.locator('.notes-editor .md-root p')).toHaveText('the edited task note');
    });

    test('empty state: no notes anywhere explains where notes live', async ({ page }) => {
        // Guarantee emptiness: a full-suite run may leave notes from
        // earlier specs. An empty-snapshot restore (the import spec's
        // pattern, prefs preserved) wipes tasks and day notes.
        const prefs = (await (await page.request.get(`${SERVER_URL}/api/preferences`)).json())
            .data as Record<string, unknown>;
        const res = await page.request.post(`${SERVER_URL}/api/import?format=json`, {
            data: JSON.stringify({
                format: 'erledigen-export',
                version: 1,
                exportedAt: new Date().toISOString(),
                tasks: [],
                someDayGroups: [],
                projects: [],
                recurringTasks: [],
                userPreferences: prefs,
            }),
            headers: { 'Content-Type': 'text/plain' },
        });
        expect(res.status()).toBe(200);

        await hydrated(page);
        await page.keyboard.press('g');
        await page.keyboard.press('n');
        const notesModal = modal(page, 'Notes');
        await expect(notesModal).toBeVisible();
        await expect(notesModal.locator('.empty')).toContainText('No notes anywhere yet');
    });
});

test.describe('markdown security -- safe by construction (ADR-015)', () => {
    test('a script payload in notes never executes or renders as markup', async ({ page }) => {
        const text = uniq('xss-notes');
        const task = await createTask(page.request, { text, date: todayISO() }, SERVER_URL);
        await page.request.put(`${SERVER_URL}/api/tasks/${task.id}`, {
            data: {
                notes: '<script>window.__notesPwned = 1</script> [x](javascript:alert(1))',
            },
        });

        await hydrated(page);
        const pageErrors: string[] = [];
        page.on('pageerror', e => pageErrors.push(String(e)));

        await page.locator(`#task-${task.id} .action-btn[aria-label="Task details"]`).click();
        const detail = modal(page, 'Task Details');

        // The payload renders as inert TEXT: no script element, no
        // javascript: href, and the page variable was never set.
        await expect(detail.locator('.notes-editor script')).toHaveCount(0);
        await expect(detail.locator('.notes-editor a')).toHaveCount(0);
        const pwned = await page.evaluate(
            () => (window as unknown as { __notesPwned?: number }).__notesPwned,
        );
        expect(pwned).toBeUndefined();
        expect(pageErrors).toEqual([]);
    });
});
