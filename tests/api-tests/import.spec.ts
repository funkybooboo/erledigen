import { expect, test } from '@playwright/test';
import { cleanup, get, post, postText, uniq } from './helpers';

test.afterEach(async ({ request }) => {
    await cleanup(request);
    // Import tests mutate the shared server's data set wholesale; leave
    // it empty (prefs preserved) for the rest of the suite after each.
    await restoreEmpty(request);
});

/** An empty-snapshot restore: leaves the shared in-memory test server
 *  clean without tracking server-created ids. */
async function restoreEmpty(
    request: Parameters<typeof get>[0],
): Promise<void> {
    const prefs = (await get(request, '/api/preferences')).body.data as Record<string, unknown>;
    const res = await postText(
        request,
        '/api/import?format=json',
        JSON.stringify({
            format: 'erledigen-export',
            version: 1,
            exportedAt: '2026-01-01T00:00:00.000Z',
            tasks: [],
            someDayGroups: [],
            projects: [],
            recurringTasks: [],
            userPreferences: prefs,
        }),
    );
    expect(res.status).toBe(200);
}

test.describe('import -- POST /api/import (ADR-009)', () => {
    test('json restore: replaces everything, keeps ids and preferences verbatim', async ({
        request,
    }) => {
        const keepText = uniq('import-restore-keeps');
        const dropText = uniq('import-restore-drops');
        const keep = await post(request, '/api/tasks', {
            text: keepText,
            date: '2026-03-14',
            tags: ['p1'],
        });
        await post(request, '/api/tasks', { text: dropText, date: '2026-03-15' });

        const exportRes = await get(request, '/api/export?format=json');
        const snapshot = exportRes.body as {
            tasks: { id: string; text: string; date: string; tags: string[] }[];
            userPreferences: Record<string, unknown>;
        };
        // Drop one task and flip the theme in the snapshot: restore must
        // reproduce the snapshot EXACTLY, not merge it.
        const droppedId = snapshot.tasks.find(t => t.text === dropText)?.id;
        const kept = snapshot.tasks.find(t => t.text === keepText);
        expect(kept).toBeDefined();
        const modified = {
            ...snapshot,
            tasks: snapshot.tasks.filter(t => t.text !== dropText),
            userPreferences: { ...snapshot.userPreferences, theme: 'dark' },
        };

        const res = await postText(
            request,
            '/api/import?format=json',
            JSON.stringify(modified),
        );
        expect(res.status).toBe(200);
        expect(res.body.data.mode).toBe('restore');
        expect(res.body.data.restored.tasks).toBe(modified.tasks.length);
        expect(res.body.data.restored.preferences).toBe(true);
        // In-memory test runs write no backup file.
        expect(res.body.data.backupPath).toBeNull();

        // The dropped task is gone; the kept one is back under its
        // ORIGINAL id, tags and date intact.
        expect((await get(request, `/api/tasks/${droppedId}`)).status).toBe(404);
        const keptAfter = await get(request, `/api/tasks/${kept?.id}`);
        expect(keptAfter.status).toBe(200);
        expect(keptAfter.body.data.text).toBe(keepText);
        expect(keptAfter.body.data.tags).toContain('p1');

        // Preferences were restored from the snapshot.
        const prefs = await get(request, '/api/preferences');
        expect(prefs.body.data.theme).toBe('dark');
    });

    test('json restore: rejects an invalid snapshot and wipes nothing', async ({ request }) => {
        const text = uniq('import-rejects');
        const task = await post(request, '/api/tasks', { text, date: null });

        const bad = await postText(request, '/api/import?format=json', JSON.stringify({
            format: 'erledigen-export',
            version: 2, // unsupported version
            exportedAt: '2026-01-01T00:00:00.000Z',
            tasks: [],
            someDayGroups: [],
            projects: [],
            recurringTasks: [],
            userPreferences: {},
        }));
        expect(bad.status).toBe(400);
        expect(bad.body.code).toBe('IMPORT_ERROR');

        const survivor = await get(request, `/api/tasks/${task.body.data.id}`);
        expect(survivor.status).toBe(200);
    });

    test('json restore: rejects a dangling reference', async ({ request }) => {
        const prefs = (await get(request, '/api/preferences')).body.data as Record<string, unknown>;
        const res = await postText(
            request,
            '/api/import?format=json',
            JSON.stringify({
                format: 'erledigen-export',
                version: 1,
                exportedAt: '2026-01-01T00:00:00.000Z',
                tasks: [
                    {
                        id: 't1',
                        text: 'Orphan',
                        notes: null,
                        completed: false,
                        date: null,
                        createdAt: '2026-01-01T00:00:00.000Z',
                        updatedAt: '2026-01-01T00:00:00.000Z',
                        tags: [],
                        parentId: 'nope',
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
                    },
                ],
                someDayGroups: [],
                projects: [],
                recurringTasks: [],
                userPreferences: prefs,
            }),
        );
        expect(res.status).toBe(400);
        expect(res.body.error).toContain('parentId');
    });

    test('todoist-csv: additive import with labels, priorities, subtasks', async ({ request }) => {
        const existingText = uniq('import-existing');
        await post(request, '/api/tasks', { text: existingText, date: null });

        const csv = [
            'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE',
            `task,@errands ${uniq('todoist-top')} with @home label,First row,2,1,,,2026-03-14 17:00,en,Europe/Berlin`,
            `task,${uniq('todoist-sub')},,4,2,,,,`,
            `task,${uniq('todoist-undated')},Recurring,3,1,,,every Monday,en,Europe/Berlin`,
        ].join('\r\n');
        const res = await postText(request, '/api/import?format=todoist-csv', csv);

        expect(res.status).toBe(200);
        expect(res.body.data.mode).toBe('import');
        expect(res.body.data.created).toBe(3);
        expect(res.body.data.warnings.length).toBe(1); // the recurring date
        expect(res.body.data.warnings[0]?.message).toContain('every Monday');

        const after = await get(request, '/api/tasks');
        // Existing task untouched, additive rows present.
        expect(after.body.data.some((t: { text: string }) => t.text === existingText)).toBe(
            true,
        );
        const top = after.body.data.find((t: { tags: string[] }) => t.tags.includes('errands'));
        expect(top.tags).toEqual(expect.arrayContaining(['errands', 'home', 'p2']));
        expect(top.startTime).toBe('17:00');
        const sub = after.body.data.find(
            (t: { text: string }) => t.parentId === top.id,
        );
        expect(sub).toBeDefined();
    });

    test('things-json: completed and canceled states import correctly', async ({ request }) => {
        const titles = {
            done: uniq('things-done'),
            canceled: uniq('things-canceled'),
            someday: uniq('things-someday'),
        };
        const res = await postText(
            request,
            '/api/import?format=things-json',
            JSON.stringify([
                {
                    uuid: 'u1',
                    type: 'to-do',
                    title: titles.done,
                    subtitle: '',
                    notes: '',
                    status: 'completed',
                    start: 'Anytime',
                    start_date: '2026-03-01',
                    deadline: null,
                    stop_date: null,
                    created: '2026-02-01 00:00:00',
                    modified: '2026-03-02 00:00:00',
                },
                {
                    uuid: 'u2',
                    type: 'to-do',
                    title: titles.canceled,
                    subtitle: '',
                    notes: '',
                    status: 'canceled',
                    start: 'Someday',
                    start_date: null,
                    deadline: null,
                    stop_date: null,
                    created: '2026-02-01 00:00:00',
                    modified: '2026-02-01 00:00:00',
                },
                {
                    uuid: 'u3',
                    type: 'to-do',
                    title: titles.someday,
                    subtitle: '',
                    notes: '',
                    status: 'incomplete',
                    start: 'Someday',
                    start_date: null,
                    deadline: '2026-12-31',
                    stop_date: null,
                    created: '2026-02-01 00:00:00',
                    modified: '2026-02-01 00:00:00',
                },
            ]),
        );
        expect(res.status).toBe(200);
        expect(res.body.data.created).toBe(3);

        const after = await get(request, '/api/tasks');
        const done = after.body.data.find((t: { text: string }) => t.text === titles.done);
        expect(done.completed).toBe(true);
        const someday = after.body.data.find(
            (t: { text: string }) => t.text === titles.someday,
        );
        expect(someday.date).toBeNull();
        expect(someday.notes).toContain('Deadline: 2026-12-31');
        // Canceled lands in the trash, restorable.
        const canceled = after.body.data.find(
            (t: { text: string }) => t.text === titles.canceled,
        );
        expect(canceled).toBeUndefined();
        const trash = await get(request, '/api/tasks/trash');
        const trashed = trash.body.data.find(
            (t: { text: string }) => t.text === titles.canceled,
        );
        expect(trashed).toBeDefined();
    });

    test('ics: timed and all-day events import', async ({ request }) => {
        const summary = uniq('ics-event');
        const allDay = uniq('ics-allday');
        const ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Test//Test//EN',
            'CALSCALE:GREGORIAN',
            'BEGIN:VEVENT',
            `SUMMARY:${summary}`,
            'DTSTART:20260314T090000',
            'DTEND:20260314T100000',
            'DESCRIPTION:Calendar import test',
            'CATEGORIES:health',
            'UID:ics-1',
            'END:VEVENT',
            'BEGIN:VEVENT',
            `SUMMARY:${allDay}`,
            'DTSTART;VALUE=DATE:20260316',
            'UID:ics-2',
            'END:VEVENT',
            'END:VCALENDAR',
        ].join('\r\n');

        const res = await postText(request, '/api/import?format=ics', ics);
        expect(res.status).toBe(200);
        expect(res.body.data.created).toBe(2);
        expect(res.body.data.warnings).toEqual([]);

        const after = await get(request, '/api/tasks');
        const timed = after.body.data.find((t: { text: string }) => t.text === summary);
        expect(timed.date).toBe('2026-03-14');
        expect(timed.startTime).toBe('09:00');
        expect(timed.endTime).toBe('10:00');
        expect(timed.notes).toBe('Calendar import test');
        expect(timed.tags).toEqual(['health']);
        const dayEvent = after.body.data.find((t: { text: string }) => t.text === allDay);
        expect(dayEvent.date).toBe('2026-03-16');
        expect(dayEvent.startTime).toBeNull();
    });

    test('csv: explicit column mapping by index', async ({ request }) => {
        const text = uniq('csv-mapped');
        const csv = ['idea,when', `${text},2026-04-02`, ''].join('\r\n');
        // "idea" -> text (col 0), "when" -> date (col 1)
        const res = await postText(
            request,
            '/api/import?format=csv&mapping=text:0,date:1',
            csv,
        );
        expect(res.status).toBe(200);
        expect(res.body.data.created).toBe(1);
        const after = await get(request, '/api/tasks');
        const task = after.body.data.find((t: { text: string }) => t.text === text);
        expect(task.date).toBe('2026-04-02');
    });

    test('csv: auto-detects our own export round-trip', async ({ request }) => {
        const text = uniq('csv-roundtrip');
        await post(request, '/api/tasks', {
            text,
            date: '2026-03-20',
            tags: ['roundtrip'],
            startTime: '09:00',
            endTime: '11:00',
        });
        const exportRes = await get(request, '/api/export?format=csv');
        const csv = exportRes.body as string;

        // Re-import our own CSV export: text/date/tags/times map cleanly.
        const res = await postText(request, '/api/import?format=csv', csv);
        expect(res.status).toBe(200);
        const imported = res.body.data.created;
        expect(imported).toBeGreaterThanOrEqual(1);
    });

    test('rejects an unknown format with 400', async ({ request }) => {
        const res = await postText(request, '/api/import?format=xml', '<x/>');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('rejects a non-Erledigen JSON restore document with 400', async ({ request }) => {
        const res = await postText(request, '/api/import?format=json', '{"hello":"world"}');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('IMPORT_ERROR');
    });
});