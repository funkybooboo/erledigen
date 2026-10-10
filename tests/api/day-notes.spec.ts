/**
 * Day notes API integration tests (v0.10.0): the paper calendar's
 * margin -- one live-markdown note per date, addressed BY DATE.
 *
 * Covers: upsert create/replace, list/get/delete, validation (empty
 * notes, malformed date), plain-text content negotiation, export
 * snapshot coverage, and the pre-v0.10.0 restore path (snapshots
 * without the dayNotes key restore with the table wiped).
 */

import { expect, test } from '@playwright/test';
import { cleanup, del, get, postText, put, track, uniq } from './helpers';

test.afterEach(async ({ request }) => {
    await cleanup(request);
});

/** PUT a day note and register it for afterEach cleanup (by date). */
async function putDayNote(
    request: Parameters<typeof get>[0],
    date: string,
    notes: string,
): Promise<ReturnType<typeof put>> {
    const res = await put(request, `/api/day-notes/${date}`, { notes });
    track('dayNote', date);
    return res;
}

test.describe('day notes -- upsert (PUT /api/day-notes/:date)', () => {
    test('creates a note on first write', async ({ request }) => {
        const res = await putDayNote(request, '2026-10-04', 'margin jot');
        expect(res.status).toBe(200);
        expect(res.body.data.date).toBe('2026-10-04');
        expect(res.body.data.notes).toBe('margin jot');
        expect(res.body.data.id).toBeDefined();
        expect(res.body.data.createdAt).toBe(res.body.data.updatedAt);
    });

    test('replaces an existing note for the same date, keeping the id', async ({ request }) => {
        const first = await putDayNote(request, '2026-10-05', 'one');
        const second = await putDayNote(request, '2026-10-05', 'two');
        expect(second.status).toBe(200);
        expect(second.body.data.notes).toBe('two');
        expect(second.body.data.id).toBe(first.body.data.id);

        const list = await get(request, '/api/day-notes');
        expect(list.body.data.filter((n: { date: string }) => n.date === '2026-10-05').length).toBe(
            1,
        );
    });

    test('rejects empty notes (clearing is DELETE)', async ({ request }) => {
        const res = await put(request, '/api/day-notes/2026-10-06', { notes: '' });
        expect(res.status).toBe(400);
    });

    test('rejects a malformed date', async ({ request }) => {
        const res = await put(request, '/api/day-notes/junk-date', { notes: 'x' });
        expect(res.status).toBe(400);
    });
});

test.describe('day notes -- read & delete', () => {
    test('lists every note in date order', async ({ request }) => {
        await putDayNote(request, '2026-12-25', 'xmas plans');
        await putDayNote(request, '2026-10-04', 'today');
        const res = await get(request, '/api/day-notes');
        expect(res.status).toBe(200);
        const dates = res.body.data.map((n: { date: string }) => n.date);
        expect(dates).toEqual([...dates].sort());
        expect(dates).toContain('2026-12-25');
        expect(dates).toContain('2026-10-04');
    });

    test('gets one note by date', async ({ request }) => {
        await putDayNote(request, '2026-10-07', 'hello');
        const res = await get(request, '/api/day-notes/2026-10-07');
        expect(res.status).toBe(200);
        expect(res.body.data.notes).toBe('hello');
    });

    test('404s for a date with no note', async ({ request }) => {
        const res = await get(request, '/api/day-notes/2030-01-01');
        expect(res.status).toBe(404);
    });

    test('deletes a note by date, then 404s', async ({ request }) => {
        await putDayNote(request, '2026-10-08', 'gone soon');
        const deleteRes = await del(request, '/api/day-notes/2026-10-08');
        expect(deleteRes.status).toBe(200);
        expect((await get(request, '/api/day-notes/2026-10-08')).status).toBe(404);
        expect((await del(request, '/api/day-notes/2026-10-08')).status).toBe(404);
    });

    test('list supports plain-text content negotiation', async ({ request }) => {
        await putDayNote(request, '2026-10-09', 'line one\nline two');
        const res = await get(request, '/api/day-notes', { Accept: 'text/plain' });
        expect(res.status).toBe(200);
        expect(String(res.body)).toContain('2026-10-09');
        expect(String(res.body)).toContain('line one');
    });
});

test.describe('day notes -- export & restore coverage (ADR-008/009)', () => {
    test('the JSON export snapshot carries day notes', async ({ request }) => {
        await putDayNote(request, '2026-10-10', uniq('exported'));
        const res = await get(request, '/api/export?format=json');
        expect(res.status).toBe(200);
        // The JSON export is a RAW document (ADR-008): the body IS the
        // snapshot, no { data } envelope.
        const snapshot = res.body as { dayNotes: Array<{ date: string; notes: string }> };
        expect(Array.isArray(snapshot.dayNotes)).toBe(true);
        expect(snapshot.dayNotes.some(n => n.date === '2026-10-10')).toBe(true);
    });

    test('a snapshot without the dayNotes key restores with notes wiped', async ({ request }) => {
        // A pre-v0.10.0 snapshot lacks the dayNotes key entirely; the
        // destructive restore must still succeed (and empty the table).
        await putDayNote(request, '2026-10-11', 'doomed by restore');
        // Build a minimal, self-consistent snapshot by hand: a long-lived
        // test server can hold cross-suite leftovers whose dangling
        // references the strict restore rightly rejects, so the live
        // export is not a safe fixture here.
        const prefsRes = await get(request, '/api/preferences');
        const snapshot = {
            format: 'erledigen-export',
            version: 1,
            exportedAt: new Date().toISOString(),
            tasks: [],
            someDayGroups: [],
            projects: [],
            recurringTasks: [],
            userPreferences: prefsRes.body.data,
        };
        const res = await postText(request, '/api/import?format=json', JSON.stringify(snapshot));
        expect(res.status).toBe(200);
        expect(res.body.data.restored.dayNotes).toBe(0);

        const after = await get(request, '/api/day-notes/2026-10-11');
        expect(after.status).toBe(404);
    });

    test('a snapshot with day notes restores them verbatim', async ({ request }) => {
        const prefsRes = await get(request, '/api/preferences');
        const snapshot = {
            format: 'erledigen-export',
            version: 1,
            exportedAt: new Date().toISOString(),
            tasks: [],
            someDayGroups: [],
            projects: [],
            recurringTasks: [],
            dayNotes: [
                {
                    id: 'n42',
                    date: '2026-11-11',
                    notes: '# Restored\nverbatim',
                    createdAt: '2026-01-01T00:00:00.000Z',
                    updatedAt: '2026-01-01T00:00:00.000Z',
                },
            ],
            userPreferences: prefsRes.body.data,
        };
        const res = await postText(request, '/api/import?format=json', JSON.stringify(snapshot));
        expect(res.status).toBe(200);
        expect(res.body.data.restored.dayNotes).toBe(1);

        const after = await get(request, '/api/day-notes/2026-11-11');
        expect(after.status).toBe(200);
        expect(after.body.data.id).toBe('n42');
        expect(after.body.data.notes).toBe('# Restored\nverbatim');
        expect(after.body.data.createdAt).toBe('2026-01-01T00:00:00.000Z');
    });

    test('rejects a snapshot with duplicate day-note dates', async ({ request }) => {
        const prefsRes = await get(request, '/api/preferences');
        const note = {
            id: 'n1',
            date: '2026-11-12',
            notes: 'dup',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
        };
        const snapshot = {
            format: 'erledigen-export',
            version: 1,
            exportedAt: new Date().toISOString(),
            tasks: [],
            someDayGroups: [],
            projects: [],
            recurringTasks: [],
            dayNotes: [note, { ...note, id: 'n2' }],
            userPreferences: prefsRes.body.data,
        };
        const res = await postText(request, '/api/import?format=json', JSON.stringify(snapshot));
        expect(res.status).toBe(400);
    });
});
