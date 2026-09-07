import { expect, test } from '@playwright/test';
import { cleanup, createTask, del, get, uniq } from './helpers';

test.afterEach(async ({ request }) => {
    await cleanup(request);
});

test.describe('export -- GET /api/export (ADR-008)', () => {
    test('json: returns the canonical snapshot with seeded tasks, as an attachment', async ({
        request,
    }) => {
        const task = await createTask(request, {
            text: 'Export spec task',
            date: '2026-01-15',
            tags: ['p1'],
        });

        const res = await get(request, '/api/export?format=json');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/json');
        expect(res.headers['content-disposition']).toContain('attachment');
        expect(res.headers['content-disposition']).toMatch(
            /^attachment; filename="erledigen-export-\d{4}-\d{2}-\d{2}\.json"$/,
        );

        // Raw document, NOT the usual { data } envelope.
        const snapshot = res.body;
        expect(snapshot.format).toBe('erledigen-export');
        expect(snapshot.version).toBe(1);
        expect(typeof snapshot.exportedAt).toBe('string');
        expect(Array.isArray(snapshot.someDayGroups)).toBe(true);
        expect(Array.isArray(snapshot.projects)).toBe(true);
        expect(Array.isArray(snapshot.recurringTasks)).toBe(true);
        expect(snapshot.userPreferences.id).toBe('default');
        const exported = snapshot.tasks.find((t: { id: string }) => t.id === task.id);
        expect(exported.text).toBe('Export spec task');
    });

    test('json: includes soft-deleted tasks (the backup keeps the trash)', async ({
        request,
    }) => {
        const task = await createTask(request, { text: 'Trash me for export', date: '2026-01-15' });
        await del(request, `/api/tasks/${task.id}`);

        const res = await get(request, '/api/export?format=json');
        expect(res.status).toBe(200);

        const trashed = res.body.tasks.find((t: { id: string }) => t.id === task.id);
        expect(trashed).toBeDefined();
        expect(trashed.deletedAt).not.toBeNull();
    });

    test('csv: returns a header row and one escaped row per active task', async ({ request }) => {
        const marker = uniq('exp-csv');
        await createTask(request, {
            text: `Say "hi", ${marker}`,
            date: '2026-01-15',
            tags: ['p1', 'errands'],
            startTime: '09:00',
        });

        const res = await get(request, '/api/export?format=csv');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/csv');
        expect(res.headers['content-disposition']).toContain('.csv');

        // RFC 4180: CRLF line endings, quoted cells for commas/quotes.
        const lines = (res.body as string).split('\r\n');
        expect(lines[0]).toMatch(/^id,text,/);
        expect(lines[0]).toMatch(/createdAt,updatedAt$/);
        const row = lines.find(l => l.includes(marker)) ?? '';
        expect(row).toContain(`"Say ""hi"", ${marker}"`);
        expect(row).toContain('p1 errands');
        expect(row).toContain('09:00');
    });

    test('csv: honors the columns subset', async ({ request }) => {
        await createTask(request, { text: 'Scoped task', date: '2026-01-15' });

        const res = await get(request, '/api/export?format=csv&columns=text,date');
        expect(res.status).toBe(200);

        const lines = (res.body as string).split('\r\n');
        expect(lines[0]).toBe('text,date');
        expect(lines[1]).toBe('Scoped task,2026-01-15');
    });

    test('csv: rejects an unknown column with 400', async ({ request }) => {
        const res = await get(request, '/api/export?format=csv&columns=text,nope');
        expect(res.status).toBe(400);
        expect(res.body.error).toBeTruthy();
    });

    test('md: groups by date with checkbox syntax; someday lands in its own section', async ({
        request,
    }) => {
        const dated = uniq('exp-md');
        const someday = uniq('exp-someday');
        await createTask(request, { text: `Dated ${dated}`, date: '2026-01-15' });
        await createTask(request, { text: `Someday ${someday}`, date: null });

        const res = await get(request, '/api/export?format=md');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/markdown');

        const body = res.body as string;
        expect(body).toContain('## 2026-01-15');
        expect(body).toContain(`- [ ] Dated ${dated}`);
        expect(body).toContain('## Someday');
        expect(body).toContain(`- [ ] Someday ${someday}`);
        expect(body.indexOf('## 2026-01-15')).toBeLessThan(body.indexOf('## Someday'));
    });

    test('ics: exports timed tasks as VEVENTs inside a VCALENDAR', async ({ request }) => {
        const marker = uniq('exp-ics');
        await createTask(request, {
            text: `Standup ${marker}`,
            date: '2026-01-15',
            startTime: '09:00',
            endTime: '09:15',
        });
        const undated = uniq('exp-undated');
        await createTask(request, { text: `Undated ${undated}`, date: null });

        const res = await get(request, '/api/export?format=ics');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/calendar');
        expect(res.headers['content-disposition']).toContain('.ics');

        const body = res.body as string;
        expect(body).toContain('BEGIN:VCALENDAR');
        expect(body).toContain('VERSION:2.0');
        expect(body).toContain('BEGIN:VEVENT');
        expect(body).toContain(`SUMMARY:Standup ${marker}`);
        expect(body).toContain('DTSTART:20260115T090000');
        expect(body).toContain('DTEND:20260115T091500');
        // Undated (Someday) tasks have no calendar date and stay out.
        expect(body).not.toContain(`Undated ${undated}`);
        expect(body).toContain('END:VCALENDAR');
    });

    test('json is the default format', async ({ request }) => {
        const res = await get(request, '/api/export');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/json');
        expect(res.body.format).toBe('erledigen-export');
    });

    test('rejects an unknown format with the standard error envelope', async ({ request }) => {
        const res = await get(request, '/api/export?format=xml');
        expect(res.status).toBe(400);
        expect(res.body.error).toBeTruthy();
        expect(res.body.code).toBeTruthy();
    });
});