import { expect, test } from '@playwright/test';
import { get, patch } from './helpers';

test.describe('user preferences -- GET /api/preferences', () => {
    test('returns the default preferences singleton', async ({ request }) => {
        const res = await get(request, '/api/preferences');
        expect(res.status).toBe(200);
        const prefs = res.body.data;
        expect(prefs.id).toBe('default');
        expect(['light', 'dark', 'system']).toContain(prefs.theme);
        expect(['blue', 'coral', 'amber']).toContain(prefs.accent);
        expect(['instant', 'confirm']).toContain(prefs.deleteConfirmation);
        expect(['12h', '24h']).toContain(prefs.timeFormat);
        expect(['midnight', '9am', 'manual']).toContain(prefs.rolloverTriggerTime);
        expect(prefs.activeFilters).toHaveProperty('tags');
        expect(prefs.activeFilters).toHaveProperty('showCompleted');
        expect(['manual', 'priority']).toContain(prefs.activeFilters.sortMode);
        expect(['object', 'null']).toContain(typeof prefs.activeFilters.dateFrom);
        expect(['object', 'null']).toContain(typeof prefs.activeFilters.dateTo);
        expect(Array.isArray(prefs.tagKinds)).toBe(true);
    });
});

test.describe('user preferences -- PATCH /api/preferences', () => {
    test('updates a single field and returns the merged preferences', async ({ request }) => {
        // Get current value to restore later.
        const before = await get(request, '/api/preferences');
        const origTheme = before.body.data.theme;

        const res = await patch(request, '/api/preferences', { theme: 'dark' });
        expect(res.status).toBe(200);
        expect(res.body.data.theme).toBe('dark');
        // Unchanged fields preserved.
        expect(res.body.data.id).toBe('default');

        // Restore to avoid leaking state across tests.
        await patch(request, '/api/preferences', { theme: origTheme });
    });

    test('updates nested activeFilters (sort mode + date range included)', async ({ request }) => {
        const before = await get(request, '/api/preferences');
        const orig = before.body.data.activeFilters;

        const res = await patch(request, '/api/preferences', {
            activeFilters: {
                tags: ['#test'],
                showCompleted: false,
                sortMode: 'priority',
                dateFrom: '2026-10-01',
                dateTo: '2026-10-15',
            },
        });
        expect(res.status).toBe(200);
        expect(res.body.data.activeFilters.tags).toEqual(['#test']);
        expect(res.body.data.activeFilters.showCompleted).toBe(false);
        expect(res.body.data.activeFilters.sortMode).toBe('priority');
        expect(res.body.data.activeFilters.dateFrom).toBe('2026-10-01');
        expect(res.body.data.activeFilters.dateTo).toBe('2026-10-15');

        // Restore.
        await patch(request, '/api/preferences', { activeFilters: orig });
    });

    test('rejects activeFilters with a malformed date bound', async ({ request }) => {
        const res = await patch(request, '/api/preferences', {
            activeFilters: {
                tags: [],
                showCompleted: true,
                sortMode: 'manual',
                dateFrom: 'october-1',
                dateTo: null,
            },
        });
        expect(res.status).toBe(400);
    });

    test('updates someDayPanelWidth within bounds', async ({ request }) => {
        const before = await get(request, '/api/preferences');
        const orig = before.body.data.someDayPanelWidth;

        const res = await patch(request, '/api/preferences', { someDayPanelWidth: 400 });
        expect(res.status).toBe(200);
        expect(res.body.data.someDayPanelWidth).toBe(400);

        await patch(request, '/api/preferences', { someDayPanelWidth: orig });
    });

    test('rejects invalid theme with 400', async ({ request }) => {
        const res = await patch(request, '/api/preferences', { theme: 'neon' });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
        expect(res.body.details?.fields).toHaveProperty('theme');
    });

    test('updates and validates the accent scheme', async ({ request }) => {
        const res = await patch(request, '/api/preferences', { accent: 'coral' });
        expect(res.status).toBe(200);
        expect(res.body.data.accent).toBe('coral');
        // Theme field untouched by the accent update.
        expect(['light', 'dark', 'system']).toContain(res.body.data.theme);

        const bad = await patch(request, '/api/preferences', { accent: 'magenta' });
        expect(bad.status).toBe(400);
        expect(bad.body.code).toBe('VALIDATION_ERROR');

        // Restore the default for the shared singleton.
        await patch(request, '/api/preferences', { accent: 'blue' });
    });

    test('updates and validates tag colors', async ({ request }) => {
        const res = await patch(request, '/api/preferences', {
            tagColors: { work: 'sky', errands: 'amber' },
        });
        expect(res.status).toBe(200);
        expect(res.body.data.tagColors).toEqual({ work: 'sky', errands: 'amber' });

        // Unknown palette ids are rejected at the door.
        const bad = await patch(request, '/api/preferences', {
            tagColors: { work: 'sparkly' },
        });
        expect(bad.status).toBe(400);
        expect(bad.body.code).toBe('VALIDATION_ERROR');

        // Restore the empty map for the shared singleton.
        await patch(request, '/api/preferences', { tagColors: {} });
    });

    test('rejects someDayPanelWidth over 800 with 400', async ({ request }) => {
        const res = await patch(request, '/api/preferences', { someDayPanelWidth: 801 });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    test('rejects someDayPanelWidth < 0 with 400', async ({ request }) => {
        const res = await patch(request, '/api/preferences', { someDayPanelWidth: -1 });
        expect(res.status).toBe(400);
    });

    test('rejects invalid deleteConfirmation enum with 400', async ({ request }) => {
        const res = await patch(request, '/api/preferences', { deleteConfirmation: 'maybe' });
        expect(res.status).toBe(400);
    });

    test('PATCH rolloverTriggerTime persists and validates', async ({ request }) => {
        const ok = await patch(request, '/api/preferences', { rolloverTriggerTime: '9am' });
        expect(ok.status).toBe(200);
        expect(ok.body.data.rolloverTriggerTime).toBe('9am');

        const bad = await patch(request, '/api/preferences', { rolloverTriggerTime: 'noon' });
        expect(bad.status).toBe(400);

        // Restore the default for the shared singleton.
        await patch(request, '/api/preferences', { rolloverTriggerTime: 'midnight' });
    });
});

test.describe('user preferences -- content negotiation', () => {
    test('Accept: text/plain returns formatted preferences text', async ({ request }) => {
        const res = await get(request, '/api/preferences', { Accept: 'text/plain' });
        expect(res.status).toBe(200);
        expect(typeof res.body).toBe('string');
        expect(res.body).toContain('theme:');
        expect(res.body).toContain('locale:');
        expect(res.body).toContain('rolloverEnabled:');
        expect(res.body).toContain('showEmptyDays:');
        expect(res.body).toContain('someDayPanelWidth:');
    });
});
