import { expect, test } from '@playwright/test';
import { cleanup, createList, createTab, del, get, post, put, track, uniq } from './helpers';

test.afterEach(async ({ request }) => {
    await cleanup(request);
});

test.describe('someday-lists -- create (POST /api/someday-lists)', () => {
    test('creates a list under a tab', async ({ request }) => {
        const res = await post(request, '/api/someday-lists', {
            tabId: 'default',
            name: 'Reading list',
            position: 1,
        });
        expect(res.status).toBe(201);
        track('list', res.body.data.id);
        const list = res.body.data;
        expect(list.id).toBeTruthy();
        expect(list.tabId).toBe('default');
        expect(list.name).toBe('Reading list');
        expect(list.position).toBe(1);
        expect(list.createdAt).toBeTruthy();
    });

    test('creates a list under a new tab', async ({ request }) => {
        const tab = await createTab(request, { name: uniq('Lists tab'), position: 1 });
        const res = await post(request, '/api/someday-lists', {
            tabId: tab.id,
            name: 'In my tab',
            position: 0,
        });
        expect(res.status).toBe(201);
        track('list', res.body.data.id);
        expect(res.body.data.tabId).toBe(tab.id);
    });

    test('rejects a missing tabId with 400', async ({ request }) => {
        const res = await post(request, '/api/someday-lists', { name: 'No tab', position: 0 });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.details?.fields).toHaveProperty('tabId');
    });

    test('rejects empty name with 400', async ({ request }) => {
        const res = await post(request, '/api/someday-lists', {
            tabId: 'default',
            name: '',
            position: 0,
        });
        expect(res.status).toBe(400);
        expect(res.body.details?.fields).toHaveProperty('name');
    });

    test('rejects negative position with 400', async ({ request }) => {
        const res = await post(request, '/api/someday-lists', {
            tabId: 'default',
            name: 'Bad pos',
            position: -1,
        });
        expect(res.status).toBe(400);
    });
});

test.describe('someday-lists -- list & by id', () => {
    test('GET /api/someday-lists returns the seeded default list', async ({ request }) => {
        const res = await get(request, '/api/someday-lists');
        expect(res.status).toBe(200);
        const lists = res.body.data as Array<{ id: string; tabId: string }>;
        expect(Array.isArray(lists)).toBe(true);
        expect(lists.map(l => l.id)).toContain('default-list');
        expect(lists.map(l => l.tabId)).toContain('default');
    });

    test('GET by id returns the list', async ({ request }) => {
        const list = await createList(request, {
            tabId: 'default',
            name: uniq('Get me'),
            position: 1,
        });
        const res = await get(request, `/api/someday-lists/${list.id}`);
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(list.id);
    });

    test('GET unknown id returns 404', async ({ request }) => {
        const res = await get(request, '/api/someday-lists/999999');
        expect(res.status).toBe(404);
    });
});

test.describe('someday-lists -- update', () => {
    test('PUT updates name and position', async ({ request }) => {
        const list = await createList(request, { tabId: 'default', name: 'Orig', position: 1 });
        const res = await put(request, `/api/someday-lists/${list.id}`, {
            name: 'Edited',
            position: 4,
        });
        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('Edited');
        expect(res.body.data.position).toBe(4);
    });

    test('PUT moves the list to another tab', async ({ request }) => {
        const tab = await createTab(request, { name: uniq('Move target'), position: 1 });
        const list = await createList(request, { tabId: 'default', name: 'Mover', position: 1 });
        const res = await put(request, `/api/someday-lists/${list.id}`, { tabId: tab.id });
        expect(res.status).toBe(200);
        expect(res.body.data.tabId).toBe(tab.id);
    });

    test('PUT with empty name returns 400', async ({ request }) => {
        const list = await createList(request, { tabId: 'default', name: 'Keep', position: 1 });
        const res = await put(request, `/api/someday-lists/${list.id}`, { name: '' });
        expect(res.status).toBe(400);
    });

    test('PUT unknown id returns 404', async ({ request }) => {
        const res = await put(request, '/api/someday-lists/999999', { name: 'x' });
        expect(res.status).toBe(404);
    });
});

test.describe('someday-lists -- delete', () => {
    test('DELETE removes the list', async ({ request }) => {
        const list = await createList(request, {
            tabId: 'default',
            name: uniq('Delete me'),
            position: 1,
        });
        const res = await del(request, `/api/someday-lists/${list.id}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual({ success: true });
        const getRes = await get(request, `/api/someday-lists/${list.id}`);
        expect(getRes.status).toBe(404);
    });

    test('DELETE unknown id returns 404', async ({ request }) => {
        const res = await del(request, '/api/someday-lists/999999');
        expect(res.status).toBe(404);
    });
});

test.describe('someday-lists -- content negotiation', () => {
    test('Accept: text/plain returns formatted text', async ({ request }) => {
        await createList(request, { tabId: 'default', name: uniq('Plain list'), position: 1 });
        const res = await get(request, '/api/someday-lists', { Accept: 'text/plain' });
        expect(res.status).toBe(200);
        expect(typeof res.body).toBe('string');
        expect(res.body).toContain('tab default');
    });
});
