import { expect, test } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { cleanup, createHoliday, del, get, post, postText, put, track, uniq } from './helpers';

test.afterEach(async ({ request }) => {
    await cleanup(request);
});

/** A small holiday calendar served over real HTTP for the URL import
 *  tests -- the server fetches it server-side, so the request must come
 *  from an actual origin. */
const ICS_FIXTURE = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Erledigen API Tests//EN',
    'BEGIN:VEVENT',
    'UID:api-test-xmas',
    'DTSTART;VALUE=DATE:20270625',
    'SUMMARY:API Test Christmas',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:api-test-boxing',
    'DTSTART;VALUE=DATE:20270626',
    'SUMMARY:API Test Boxing Day',
    'END:VEVENT',
    'END:VCALENDAR',
].join('\r\n');

/** Serve ICS_FIXTURE on an ephemeral port; resolves the listening URL. */
async function serveIcsFixture(status = 200): Promise<{ url: string; close: () => void }> {
    const server: Server = createServer((req, res) => {
        if (status !== 200) {
            res.writeHead(status);
            res.end('nope');
            return;
        }
        res.writeHead(200, { 'Content-Type': 'text/calendar' });
        res.end(ICS_FIXTURE);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') {
        throw new Error('no listen address');
    }
    return {
        url: `http://127.0.0.1:${address.port}/holidays.ics`,
        close: () => server.close(),
    };
}

test.describe('holidays -- create (POST /api/holidays)', () => {
    test('creates a holiday with name and date', async ({ request }) => {
        const res = await post(request, '/api/holidays', {
            name: 'Founders Day',
            date: '2027-07-24',
        });
        expect(res.status).toBe(201);
        track('holiday', res.body.data.id);
        expect(res.body.data.id).toBeTruthy();
        expect(res.body.data.name).toBe('Founders Day');
        expect(res.body.data.date).toBe('2027-07-24');
        expect(res.body.data.createdAt).toBeTruthy();
    });

    test('rejects an empty name with 400', async ({ request }) => {
        const res = await post(request, '/api/holidays', { name: '', date: '2027-01-01' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.details?.fields).toHaveProperty('name');
    });

    test('rejects a malformed date with 400', async ({ request }) => {
        const res = await post(request, '/api/holidays', { name: 'Bad date', date: 'july-4' });
        expect(res.status).toBe(400);
        expect(res.body.details?.fields).toHaveProperty('date');
    });

    test('rejects a name over 500 chars with 400', async ({ request }) => {
        const res = await post(request, '/api/holidays', { name: 'x'.repeat(501), date: '2027-01-01' });
        expect(res.status).toBe(400);
    });

    test('rejects an unknown extra field (stripped, not stored)', async ({ request }) => {
        const res = await post(request, '/api/holidays', {
            name: 'Strict shape',
            date: '2027-02-02',
            id: 'injected',
            createdAt: 'injected',
        });
        expect(res.status).toBe(201);
        track('holiday', res.body.data.id);
        expect(res.body.data.id).not.toBe('injected');
        expect(res.body.data.createdAt).not.toBe('injected');
    });
});

test.describe('holidays -- list & by id', () => {
    test('lists holidays in calendar order', async ({ request }) => {
        const late = await createHoliday(request, { name: uniq('Late'), date: '2027-12-20' });
        const early = await createHoliday(request, { name: uniq('Early'), date: '2027-02-20' });
        const res = await get(request, '/api/holidays');
        expect(res.status).toBe(200);
        const ids = res.body.data.map((h: { id: string }) => h.id);
        expect(ids.indexOf(early.id)).toBeGreaterThan(-1);
        expect(ids.indexOf(late.id)).toBeGreaterThan(-1);
        expect(ids.indexOf(early.id)).toBeLessThan(ids.indexOf(late.id));
    });

    test('GET by id returns the holiday', async ({ request }) => {
        const holiday = await createHoliday(request, { name: 'Get me', date: '2027-03-03' });
        const res = await get(request, `/api/holidays/${holiday.id}`);
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(holiday.id);
    });

    test('GET unknown id returns 404', async ({ request }) => {
        const res = await get(request, '/api/holidays/999999');
        expect(res.status).toBe(404);
    });

    test('plain text content negotiation lists name and date', async ({ request }) => {
        const holiday = await createHoliday(request, {
            name: uniq('TextNegotiation'),
            date: '2027-04-04',
        });
        const res = await get(request, '/api/holidays', { Accept: 'text/plain' });
        expect(res.status).toBe(200);
        expect(String(res.body)).toContain(holiday.name);
        expect(String(res.body)).toContain('2027-04-04');
    });
});

test.describe('holidays -- update & delete', () => {
    test('PUT updates name and date', async ({ request }) => {
        const holiday = await createHoliday(request, { name: 'Before', date: '2027-05-05' });
        const res = await put(request, `/api/holidays/${holiday.id}`, {
            name: 'After',
            date: '2027-05-06',
        });
        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('After');
        expect(res.body.data.date).toBe('2027-05-06');
    });

    test('PUT unknown id returns 404', async ({ request }) => {
        const res = await put(request, '/api/holidays/999999', { name: 'Nope' });
        expect(res.status).toBe(404);
    });

    test('DELETE removes the holiday', async ({ request }) => {
        const holiday = await createHoliday(request, { name: 'Doomed', date: '2027-06-06' });
        const res = await del(request, `/api/holidays/${holiday.id}`);
        expect(res.status).toBe(200);
        expect(res.body.data.success).toBe(true);
        const after = await get(request, `/api/holidays/${holiday.id}`);
        expect(after.status).toBe(404);
    });

    test('DELETE unknown id returns 404', async ({ request }) => {
        const res = await del(request, '/api/holidays/999999');
        expect(res.status).toBe(404);
    });
});

test.describe('holidays -- .ics import (POST /api/holidays/import)', () => {
    test('imports raw .ics text and creates the named dates', async ({ request }) => {
        const res = await postText(request, '/api/holidays/import', ICS_FIXTURE);
        expect(res.status).toBe(200);
        expect(res.body.data.holidays.length).toBe(2);
        for (const holiday of res.body.data.holidays) {
            track('holiday', holiday.id);
        }
        const names = res.body.data.holidays.map((h: { name: string }) => h.name);
        expect(names).toContain('API Test Christmas');
        expect(names).toContain('API Test Boxing Day');
        expect(res.body.data.skipped).toBe(0);
    });

    test('re-importing the same document skips everything as duplicates', async ({ request }) => {
        const first = await postText(request, '/api/holidays/import', ICS_FIXTURE);
        expect(first.status).toBe(200);
        for (const holiday of first.body.data.holidays) {
            track('holiday', holiday.id);
        }
        const second = await postText(request, '/api/holidays/import', ICS_FIXTURE);
        expect(second.status).toBe(200);
        expect(second.body.data.holidays).toEqual([]);
        expect(second.body.data.skipped).toBe(2);
    });

    test('rejects a non-iCal document with 400', async ({ request }) => {
        const res = await postText(request, '/api/holidays/import', 'just some text');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('IMPORT_ERROR');
    });

    test('imports from a URL (JSON body; the server fetches)', async ({ request }) => {
        const fixture = await serveIcsFixture();
        try {
            const res = await post(request, '/api/holidays/import', { url: fixture.url });
            expect(res.status).toBe(200);
            expect(res.body.data.holidays.length).toBe(2);
            for (const holiday of res.body.data.holidays) {
                track('holiday', holiday.id);
            }
        } finally {
            fixture.close();
        }
    });

    test('rejects a non-http(s) URL with 400', async ({ request }) => {
        const res = await post(request, '/api/holidays/import', { url: 'ftp://example.com/x.ics' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('a failing fetch surfaces the HTTP status with 400', async ({ request }) => {
        const fixture = await serveIcsFixture(500);
        try {
            const res = await post(request, '/api/holidays/import', { url: fixture.url });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('500');
        } finally {
            fixture.close();
        }
    });
});

test.describe('holidays -- export & restore coverage (ADR-008/009)', () => {
    test('the JSON export snapshot carries holidays', async ({ request }) => {
        const holiday = await createHoliday(request, {
            name: uniq('Exported'),
            date: '2027-08-08',
        });
        const res = await get(request, '/api/export?format=json');
        expect(res.status).toBe(200);
        // The JSON export is a RAW document (ADR-008): the body IS the
        // snapshot, no { data } envelope.
        const snapshot = res.body as { holidays: Array<{ id: string }> };
        expect(Array.isArray(snapshot.holidays)).toBe(true);
        expect(snapshot.holidays.some(h => h.id === holiday.id)).toBe(true);
    });

    test('a snapshot without the holidays key restores with holidays wiped', async ({ request }) => {
        // A pre-v0.9.0 snapshot lacks the holidays key entirely; the
        // destructive restore must still succeed (and empty the table).
        const orphan = await createHoliday(request, {
            name: uniq('DoomedByRestore'),
            date: '2027-09-09',
        });
        const exportRes = await get(request, '/api/export?format=json');
        const snapshot = exportRes.body as Record<string, unknown>;
        delete snapshot.holidays;
        const res = await postText(request, '/api/import?format=json', JSON.stringify(snapshot));
        expect(res.status).toBe(200);
        expect(res.body.data.restored.holidays).toBe(0);

        const after = await get(request, `/api/holidays/${orphan.id}`);
        expect(after.status).toBe(404);
    });
});