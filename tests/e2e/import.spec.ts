import { expect, test } from '@playwright/test';
import { createTask, postText, uniq } from '../api-tests/helpers';
import { hydrated, modal, SERVER_URL, todayISO } from './util';
import type { ExportSnapshot } from '@erledigen/shared';

/** Fetch the live server's snapshot via the API (for restore fixtures). */
async function getSnapshot(request: Parameters<typeof createTask>[0]): Promise<ExportSnapshot> {
    const res = await request.get(`${SERVER_URL}/api/export?format=json`);
    return (await res.json()) as ExportSnapshot;
}

/** Restore an empty snapshot via the API (test cleanup that also clears
 *  tasks the UI import created without server-side tracking). */
async function restoreEmpty(request: Parameters<typeof createTask>[0]): Promise<void> {
    const snapshot = await getSnapshot(request);
    await postText(
        request,
        '/api/import?format=json',
        JSON.stringify({ ...snapshot, tasks: [], someDayGroups: [], projects: [], recurringTasks: [] }),
        SERVER_URL,
    );
}

/** Minimal task row for a restore snapshot. */
function snapshotTask(id: string, text: string, date: string | null): ExportSnapshot['tasks'][number] {
    return {
        id,
        text,
        notes: null,
        completed: false,
        date,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        tags: [],
        parentId: null,
        rolloverEnabled: false,
        someDayGroupId: null,
        position: null,
        state: null,
        recurringTaskId: null,
        instanceDate: null,
        originalScheduledDate: null,
        daysLate: 0,
        dependsOn: null,
        startTime: null,
        endTime: null,
        reminder: null,
        deletedAt: null,
    };
}

test.afterEach(async ({ request }) => {
    // Restore tests replace the shared server's whole data set; empty it
    // (prefs preserved) so the rest of the suite sees a clean slate.
    await restoreEmpty(request);
});

test.describe('Settings import (ADR-009)', () => {
    test('additive Todoist CSV import creates tasks and shows the summary', async ({ page }) => {
        const marker = uniq('e2e-todoist');
        await hydrated(page);
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        const settings = modal(page, 'Settings');

        await settings.locator('#import-format-select').selectOption('todoist-csv');
        await settings.locator('#import-file-input').setInputFiles({
            name: 'todoist.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(
                [
                    'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,DATE',
                    `task,${marker} @home,From e2e,2,1,${todayISO()}`,
                    `task,${marker}-sub,,4,2,`,
                ].join('\r\n'),
            ),
        });
        await settings.getByRole('button', { name: 'Import', exact: true }).click();

        await expect(settings.getByRole('status')).toContainText('Imported 2 task(s)');
        // The imported task is live in the day list (dated today).
        await expect(page.locator('.day-section.today', { hasText: marker })).toBeVisible();
        // The restore-confirmation dialog never appears for additive imports.
        await expect(modal(page, 'Confirm')).toHaveCount(0);
    });

    test('generic CSV shows the column mapping, auto-detected', async ({ page }) => {
        const marker = uniq('e2e-csv-map');
        await hydrated(page);
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        const settings = modal(page, 'Settings');

        await settings.locator('#import-format-select').selectOption('csv');
        await settings.locator('#import-file-input').setInputFiles({
            name: 'generic.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(`Title,Due Date\n${marker},${todayISO()}\n`),
        });

        // The mapping UI appears with the auto-detected columns.
        const mapping = settings.locator('.csv-mapping');
        await expect(mapping).toBeVisible();
        await expect(mapping.getByLabel('CSV column for text')).toHaveValue('Title');
        await expect(mapping.getByLabel('CSV column for date')).toHaveValue('Due Date');

        await settings.getByRole('button', { name: 'Import', exact: true }).click();
        await expect(settings.getByRole('status')).toContainText('Imported 1 task(s)');
        await expect(page.locator('.day-section.today', { hasText: marker })).toBeVisible();
    });

    test('JSON restore replaces data after explicit confirmation', async ({ page }) => {
        const doomedMarker = uniq('e2e-doomed');
        const restoredMarker = uniq('e2e-restored');
        await createTask(page.request, { text: doomedMarker, date: todayISO() }, SERVER_URL);

        await hydrated(page);
        await expect(page.locator('.day-section.today', { hasText: doomedMarker })).toBeVisible();

        // A snapshot that drops the live task and carries a new one.
        const snapshot = await getSnapshot(page.request);
        const restoreDoc = JSON.stringify({
            ...snapshot,
            tasks: [snapshotTask('e2e-1', restoredMarker, todayISO())],
        });

        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        const settings = modal(page, 'Settings');
        await settings.locator('#import-format-select').selectOption('json');
        await settings.locator('#import-file-input').setInputFiles({
            name: 'backup.json',
            mimeType: 'application/json',
            buffer: Buffer.from(restoreDoc),
        });
        await settings.getByRole('button', { name: 'Restore', exact: true }).click();

        // The destructive action always confirms first.
        const confirm = modal(page, 'Confirm');
        await expect(confirm).toBeVisible();
        await expect(confirm).toContainText('replaces ALL data');
        await confirm.getByRole('button', { name: 'Restore', exact: true }).click();

        await expect(settings.getByRole('status')).toContainText('Restored 1 task(s)');
        // The live task is gone; the restored one is in the day list.
        await expect(page.locator('.day-section.today', { hasText: restoredMarker })).toBeVisible();
        await expect(page.locator('.day-section.today', { hasText: doomedMarker })).toHaveCount(0);
    });

    test('declining the restore confirmation leaves data intact', async ({ page }) => {
        const keeperMarker = uniq('e2e-keeper');
        await createTask(page.request, { text: keeperMarker, date: todayISO() }, SERVER_URL);

        const snapshot = await getSnapshot(page.request);
        const restoreDoc = JSON.stringify({
            ...snapshot,
            tasks: [snapshotTask('e2e-2', uniq('e2e-not-restored'), todayISO())],
        });

        await hydrated(page);
        await page.getByRole('button', { name: 'Settings', exact: true }).click();
        const settings = modal(page, 'Settings');
        await settings.locator('#import-format-select').selectOption('json');
        await settings.locator('#import-file-input').setInputFiles({
            name: 'backup.json',
            mimeType: 'application/json',
            buffer: Buffer.from(restoreDoc),
        });
        await settings.getByRole('button', { name: 'Restore', exact: true }).click();
        const confirm = modal(page, 'Confirm');
        await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();

        // Nothing was restored, nothing wiped.
        await expect(settings.getByRole('status')).toHaveCount(0);
        await expect(page.locator('.day-section.today', { hasText: keeperMarker })).toBeVisible();
    });

    test('a data:restored broadcast refreshes this page without reload', async ({ page }) => {
        const goneMarker = uniq('e2e-broadcast-gone');
        const arrivedMarker = uniq('e2e-broadcast-new');
        await createTask(page.request, { text: goneMarker, date: todayISO() }, SERVER_URL);

        await hydrated(page);
        await expect(page.locator('.day-section.today', { hasText: goneMarker })).toBeVisible();

        // A restore from ANOTHER client (the bare API request carries no
        // x-client-id, so this page receives the data:restored broadcast).
        const snapshot = await getSnapshot(page.request);
        await postText(
            page.request,
            '/api/import?format=json',
            JSON.stringify({
                ...snapshot,
                tasks: [snapshotTask('e2e-3', arrivedMarker, todayISO())],
            }),
            SERVER_URL,
        );

        await expect(page.locator('.day-section.today', { hasText: goneMarker })).toHaveCount(0);
        await expect(page.locator('.day-section.today', { hasText: arrivedMarker })).toBeVisible();
    });
});