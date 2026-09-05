import { expect, test } from '@playwright/test';
import { get } from './helpers';

test.describe('meta -- platform endpoints', () => {
    test('GET / returns hello text', async ({ request }) => {
        const res = await get(request, '/');
        expect(res.status).toBe(200);
        expect(res.body).toBe('Hello from Bun Server!');
    });

    test('GET /api/health returns ok with status details', async ({ request }) => {
        const res = await get(request, '/api/health');
        expect(res.status).toBe(200);
        const data = res.body.data;
        expect(data.status).toBe('ok');
        expect(typeof data.uptime).toBe('number');
        expect(typeof data.version).toBe('string');
        // The api project boots the server with STORAGE_ADAPTER=memory.
        expect(data.database.type).toBe('memory');
        expect(data.database.sizeBytes).toBeNull();
        expect(typeof data.connections.websocket).toBe('number');
    });

    test('GET /api/health echoes an incoming request ID (ADR-004)', async ({ request }) => {
        const res = await get(request, '/api/health', { 'X-Request-Id': 'meta-trace-42' });
        expect(res.headers['x-request-id']).toBe('meta-trace-42');
    });

    test('GET /api/metrics serves Prometheus text with live request series', async ({
        request,
    }) => {
        // Exercise a real route first so the request counter has a series.
        await get(request, '/api/health');
        const res = await get(request, '/api/metrics');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/plain');
        expect(res.body).toContain('# TYPE erledigen_http_requests_total counter');
        expect(res.body).toContain('path="/api/health"');
        expect(res.body).toContain('erledigen_uptime_seconds');
        expect(res.body).toContain('erledigen_tasks_total');
        expect(res.body).toContain('erledigen_build_info');
    });

    test('unknown route returns 404 with CORS headers', async ({ request }) => {
        const res = await get(request, '/api/does-not-exist');
        expect(res.status).toBe(404);
        expect(res.body).toBe('Not Found');
        // CORS preflight is allowed by the server for all origins.
        expect(res.headers['access-control-allow-origin']).toBe('*');
    });

    test('OPTIONS preflight returns CORS allow headers', async ({ request }) => {
        const r = await request.fetch('/api/tasks', { method: 'OPTIONS' });
        // Bun returns 204 for an empty OPTIONS preflight with CORS headers.
        expect(r.status()).toBeLessThan(400);
        const h = await r.headers();
        expect(h['access-control-allow-origin']).toBe('*');
        expect(h['access-control-allow-methods']).toContain('GET');
    });
});

test.describe('meta -- security headers on every response', () => {
    test('health response carries nosniff / frame / csp headers', async ({ request }) => {
        const res = await get(request, '/api/health');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('DENY');
        expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    });
});

test.describe('meta -- OpenAPI spec is served', () => {
    test('GET /openapi.json returns a JSON OpenAPI document', async ({ request }) => {
        const res = await get(request, '/openapi.json');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('openapi');
        expect(res.body).toHaveProperty('paths');
        // A representative path from each resource should be documented.
        for (const path of ['/api/tasks', '/api/projects', '/api/recurring-tasks', '/api/someday-groups', '/api/preferences']) {
            expect(res.body.paths).toHaveProperty(path);
        }
    });

    test('GET /openapi.yaml returns YAML with application/yaml content type', async ({ request }) => {
        const res = await get(request, '/openapi.yaml');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/yaml');
        expect(res.headers['content-type']).toContain('charset=utf-8');
        expect(typeof res.body).toBe('string');
        expect(res.body).toContain('openapi:');
        expect(res.body).toContain('/api/tasks');
    });
});