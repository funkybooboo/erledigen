import { expect, test } from '@playwright/test';
import { cleanup, createTab, del, get, post, put, track, uniq } from './helpers';

test.afterEach(async ({ request }) => {
    await cleanup(request);
});

test.describe('someday-tabs -- create (POST /api/someday-tabs)', () => {
    test('creates a plain tab (projectTag defaults to null)', async ({ request }) => {
        const res = await post(request, '/api/someday-tabs', {
            name: 'Reading',
            position: 1,
        });
        expect(res.status).toBe(201);
        track('tab', res.body.data.id);
        const tab = res.body.data;
        expect(tab.id).toBeTruthy();
        expect(tab.name).toBe('Reading');
        expect(tab.position).toBe(1);
        expect(tab.projectTag).toBeNull();
        expect(tab.createdAt).toBeTruthy();
    });

    test('creates a project tab carrying the project tag', async ({ request }) => {
        const res = await post(request, '/api/someday-tabs', {
            name: 'Build house',
            position: 2,
            projectTag: 'project:build-house',
        });
        expect(res.status).toBe(201);
        track('tab', res.body.data.id);
        expect(res.body.data.projectTag).toBe('project:build-house');
    });

    test('rejects empty name with 400', async ({ request }) => {
        const res = await post(request, '/api/someday-tabs', { name: '', position: 0 });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.details?.fields).toHaveProperty('name');
    });

    test('rejects negative position with 400', async ({ request }) => {
        const res = await post(request, '/api/someday-tabs', { name: 'Bad pos', position: -1 });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('rejects name over 100 chars', async ({ request }) => {
        const res = await post(request, '/api/someday-tabs', {
            name: 'x'.repeat(101),
            position: 0,
        });
        expect(res.status).toBe(400);
    });
});

test.describe('someday-tabs -- list & by id', () => {
    test('GET /api/someday-tabs always includes the seeded default tab', async ({ request }) => {
        const res = await get(request, '/api/someday-tabs');
        expect(res.status).toBe(200);
        const tabs = res.body.data as Array<{ id: string; name: string }>;
        expect(Array.isArray(tabs)).toBe(true);
        expect(tabs.map(t => t.id)).toContain('default');
    });

    test('GET by id returns the tab', async ({ request }) => {
        const tab = await createTab(request, { name: uniq('Get me'), position: 1 });
        const res = await get(request, `/api/someday-tabs/${tab.id}`);
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(tab.id);
    });

    test('GET unknown id returns 404', async ({ request }) => {
        const res = await get(request, '/api/someday-tabs/999999');
        expect(res.status).toBe(404);
    });
});

test.describe('someday-tabs -- update', () => {
    test('PUT updates name, position, projectTag', async ({ request }) => {
        const tab = await createTab(request, { name: 'Orig', position: 1 });
        const res = await put(request, `/api/someday-tabs/${tab.id}`, {
            name: 'Edited',
            position: 3,
            projectTag: 'project:edited',
        });
        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('Edited');
        expect(res.body.data.position).toBe(3);
        expect(res.body.data.projectTag).toBe('project:edited');
    });

    test('PUT clears the project tag', async ({ request }) => {
        const tab = await createTab(request, {
            name: 'Plain again',
            position: 1,
            projectTag: 'project:x',
        });
        const res = await put(request, `/api/someday-tabs/${tab.id}`, { projectTag: null });
        expect(res.status).toBe(200);
        expect(res.body.data.projectTag).toBeNull();
    });

    test('PUT with empty name returns 400', async ({ request }) => {
        const tab = await createTab(request, { name: 'Keep', position: 1 });
        const res = await put(request, `/api/someday-tabs/${tab.id}`, { name: '' });
        expect(res.status).toBe(400);
    });

    test('PUT unknown id returns 404', async ({ request }) => {
        const res = await put(request, '/api/someday-tabs/999999', { name: 'x' });
        expect(res.status).toBe(404);
    });
});

test.describe('someday-tabs -- delete', () => {
    test('DELETE removes the tab', async ({ request }) => {
        const tab = await createTab(request, { name: 'Delete me', position: 1 });
        const res = await del(request, `/api/someday-tabs/${tab.id}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ success: true });
        const getRes = await get(request, `/api/someday-tabs/${tab.id}`);
        expect(getRes.status).toBe(404);
    });

    test('DELETE the default tab is rejected (unlisted tasks live in it)', async ({ request }) => {
        const res = await del(request, '/api/someday-tabs/default');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('BAD_REQUEST');
        // Still there.
        const getRes = await get(request, '/api/someday-tabs/default');
        expect(getRes.status).toBe(200);
    });

    test('DELETE unknown id returns 404', async ({ request }) => {
        const res = await del(request, '/api/someday-tabs/999999');
        expect(res.status).toBe(404);
    });
});

test.describe('someday-tabs -- content negotiation', () => {
    test('Accept: text/plain returns formatted text', async ({ request }) => {
        await createTab(request, {
            name: uniq('Plain tab'),
            position: 1,
            projectTag: 'project:plain',
        });
        const res = await get(request, '/api/someday-tabs', { Accept: 'text/plain' });
        expect(res.status).toBe(200);
        expect(typeof res.body).toBe('string');
        expect(res.body).toContain('#project:plain');
    });
});
