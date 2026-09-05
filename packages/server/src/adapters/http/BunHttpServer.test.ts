import { describe, expect, it } from 'bun:test';
import { PrometheusMetricsAdapter } from '@erledigen/shared';
import { BunHttpServer } from './BunHttpServer';
import type { Guard, HttpResponse, Middleware } from './types';

async function startServer(): Promise<BunHttpServer> {
    const server = new BunHttpServer();
    await server.start(0); // port 0 = OS assigns a free port
    return server;
}

async function fetch(server: BunHttpServer, method: string, path: string): Promise<Response> {
    const port = server.getPort();
    if (port === null) throw new Error('Server not started');
    return globalThis.fetch(`http://localhost:${port}${path}`, { method });
}

function serverUrl(server: BunHttpServer): string {
    const port = server.getPort();
    if (port === null) throw new Error('Server not started');
    return `http://localhost:${port}`;
}

describe('BunHttpServer', () => {
    describe('route matching', () => {
        it('matches an exact route', async () => {
            const server = await startServer();
            server.route('GET', '/api/health', async () => ({
                status: 200,
                headers: {},
                body: 'ok',
            }));
            const res = await fetch(server, 'GET', '/api/health');
            expect(res.status).toBe(200);
            await server.stop();
        });

        it('matches a parameterized route', async () => {
            const server = await startServer();
            server.route('GET', '/api/tasks/:id', async () => ({
                status: 200,
                headers: {},
                body: { data: 'found' },
            }));
            const res = await fetch(server, 'GET', '/api/tasks/abc123');
            expect(res.status).toBe(200);
            await server.stop();
        });

        it('returns 404 for unregistered routes', async () => {
            const server = await startServer();
            const res = await fetch(server, 'GET', '/not-found');
            expect(res.status).toBe(404);
            await server.stop();
        });

        it('returns 404 when method does not match', async () => {
            const server = await startServer();
            server.route('POST', '/api/tasks', async () => ({
                status: 201,
                headers: {},
                body: { data: 'created' },
            }));
            const res = await fetch(server, 'GET', '/api/tasks');
            expect(res.status).toBe(404);
            await server.stop();
        });

        it('handles CORS preflight (OPTIONS) without hitting a route', async () => {
            const server = await startServer();
            let handlerCalled = false;
            server.route('GET', '/api/tasks', async () => {
                handlerCalled = true;
                return { status: 200, headers: {}, body: {} };
            });
            const res = await fetch(server, 'OPTIONS', '/api/tasks');
            expect(res.status).toBe(200);
            expect(handlerCalled).toBe(false);
            await server.stop();
        });
    });

    describe('guards', () => {
        it('guard returning null lets the request through', async () => {
            const server = await startServer();
            const passthrough: Guard = () => null;
            server.addGuard(passthrough);
            server.route('GET', '/api/tasks', async () => ({
                status: 200,
                headers: {},
                body: { data: [] },
            }));
            const res = await fetch(server, 'GET', '/api/tasks');
            expect(res.status).toBe(200);
            await server.stop();
        });

        it('guard returning a response short-circuits before the handler', async () => {
            const server = await startServer();
            let handlerCalled = false;

            const blocker: Guard = () => ({
                status: 429,
                headers: {},
                body: { error: 'Rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' },
            });
            server.addGuard(blocker);

            server.route('GET', '/api/tasks', async () => {
                handlerCalled = true;
                return { status: 200, headers: {}, body: { data: [] } };
            });

            const res = await fetch(server, 'GET', '/api/tasks');
            expect(res.status).toBe(429);
            expect(handlerCalled).toBe(false); // handler was never called
            await server.stop();
        });

        it('first guard to return a response wins', async () => {
            const server = await startServer();
            const guard1: Guard = () => ({ status: 401, headers: {}, body: 'unauthorized' });
            const guard2: Guard = () => ({ status: 429, headers: {}, body: 'rate limited' });
            server.addGuard(guard1);
            server.addGuard(guard2);
            server.route('GET', '/', async () => ({ status: 200, headers: {}, body: 'ok' }));
            const res = await fetch(server, 'GET', '/');
            expect(res.status).toBe(401);
            await server.stop();
        });
    });

    describe('after-handler middleware', () => {
        it('middleware can add response headers', async () => {
            const server = await startServer();
            const addHeader: Middleware = (_req, res) => ({
                ...res,
                headers: { ...res.headers, 'X-Custom': 'test' },
            });
            server.use(addHeader);
            server.route('GET', '/', async () => ({ status: 200, headers: {}, body: 'ok' }));
            const res = await fetch(server, 'GET', '/');
            expect(res.headers.get('X-Custom')).toBe('test');
            await server.stop();
        });

        it('middleware receives the handler response and can mutate status', async () => {
            const server = await startServer();
            const mutate: Middleware = (_req, res): HttpResponse => ({ ...res, status: 201 });
            server.use(mutate);
            server.route('GET', '/', async () => ({ status: 200, headers: {}, body: 'ok' }));
            const res = await fetch(server, 'GET', '/');
            expect(res.status).toBe(201);
            await server.stop();
        });
    });

    describe('request IDs (see ADR-004)', () => {
        it('generates a fresh UUID per request and echoes it as X-Request-Id', async () => {
            const server = await startServer();
            server.route('GET', '/', async () => ({ status: 200, headers: {}, body: 'ok' }));

            const first = await fetch(server, 'GET', '/');
            const second = await fetch(server, 'GET', '/');

            const firstId = first.headers.get('X-Request-Id');
            const secondId = second.headers.get('X-Request-Id');
            expect(firstId).toBeDefined();
            expect(secondId).toBeDefined();
            expect(firstId).not.toBe(secondId);
            await server.stop();
        });

        it('accepts a safe incoming X-Request-Id for tracing', async () => {
            const server = await startServer();
            server.route('GET', '/', async () => ({ status: 200, headers: {}, body: 'ok' }));

            const res = await globalThis.fetch(`${serverUrl(server)}/`, {
                headers: { 'X-Request-Id': 'client-trace-42' },
            });

            expect(res.headers.get('X-Request-Id')).toBe('client-trace-42');
            await server.stop();
        });

        it('replaces an unsafe incoming X-Request-Id with a generated one', async () => {
            const server = await startServer();
            server.route('GET', '/', async () => ({ status: 200, headers: {}, body: 'ok' }));

            const res = await globalThis.fetch(`${serverUrl(server)}/`, {
                headers: { 'X-Request-Id': 'bad id with spaces!' },
            });

            const echoed = res.headers.get('X-Request-Id') ?? '';
            expect(echoed).not.toContain(' ');
            expect(echoed).not.toBe('bad id with spaces!');
            await server.stop();
        });

        it('exposes the request ID on HttpRequest', async () => {
            const server = await startServer();
            let seen: string | undefined;
            server.route('GET', '/', req => {
                seen = req.requestId;
                return { status: 200, headers: {}, body: 'ok' };
            });

            await fetch(server, 'GET', '/');

            expect(seen).toBeDefined();
            await server.stop();
        });

        it('carries X-Request-Id on 404s and guard short-circuits', async () => {
            const server = await startServer();
            const blocker: Guard = () => ({ status: 429, headers: {}, body: 'rate limited' });
            server.addGuard(blocker);
            server.route('GET', '/known', async () => ({ status: 200, headers: {}, body: 'ok' }));

            const notFound = await fetch(server, 'GET', '/unknown');
            const blocked = await fetch(server, 'GET', '/known');

            expect(notFound.headers.get('X-Request-Id')).toBeDefined();
            expect(blocked.headers.get('X-Request-Id')).toBeDefined();
            await server.stop();
        });
    });

    describe('request metrics (see ADR-005)', () => {
        it('records counter, duration histogram, and normalized route paths', async () => {
            const metrics = new PrometheusMetricsAdapter();
            const server = new BunHttpServer({ metrics });
            await server.start(0);
            server.route('GET', '/api/tasks/:id', async () => ({
                status: 200,
                headers: {},
                body: 'ok',
            }));

            // Two different concrete paths must land in ONE normalized
            // series -- dynamic segments must not explode the label set.
            await fetch(server, 'GET', '/api/tasks/abc123');
            await fetch(server, 'GET', '/api/tasks/xyz789');
            await fetch(server, 'GET', '/nope');

            const out = metrics.render();
            expect(out).toContain(
                'erledigen_http_requests_total{method="GET",path="/api/tasks/:id",status_code="200"} 2',
            );
            expect(out).toContain(
                'erledigen_http_requests_total{method="GET",path="unmatched",status_code="404"} 1',
            );
            expect(out).toContain(
                'erledigen_http_request_duration_seconds_count{method="GET",path="/api/tasks/:id"} 2',
            );
            await server.stop();
        });

        it('returns the in-flight gauge to zero after requests complete', async () => {
            const metrics = new PrometheusMetricsAdapter();
            const server = new BunHttpServer({ metrics });
            await server.start(0);
            server.route('GET', '/', async () => ({ status: 200, headers: {}, body: 'ok' }));

            await fetch(server, 'GET', '/');

            expect(metrics.render()).toContain('erledigen_http_requests_active{method="GET"} 0');
            await server.stop();
        });

        it('records guard short-circuits against the matched route pattern', async () => {
            const metrics = new PrometheusMetricsAdapter();
            const server = new BunHttpServer({ metrics });
            await server.start(0);
            const blocker: Guard = () => ({ status: 429, headers: {}, body: 'rate limited' });
            server.addGuard(blocker);
            server.route('GET', '/api/tasks', async () => ({
                status: 200,
                headers: {},
                body: 'ok',
            }));

            await fetch(server, 'GET', '/api/tasks');

            expect(metrics.render()).toContain(
                'erledigen_http_requests_total{method="GET",path="/api/tasks",status_code="429"} 1',
            );
            await server.stop();
        });

        it('skips CORS preflights in metrics (they are plumbing)', async () => {
            const metrics = new PrometheusMetricsAdapter();
            const server = new BunHttpServer({ metrics });
            await server.start(0);
            server.route('GET', '/api/tasks', async () => ({
                status: 200,
                headers: {},
                body: 'ok',
            }));

            await fetch(server, 'OPTIONS', '/api/tasks');

            expect(metrics.render()).toBe('');
            await server.stop();
        });
    });

    describe('response serialization', () => {
        it('sends object body as JSON', async () => {
            const server = await startServer();
            server.route('GET', '/json', async () => ({
                status: 200,
                headers: {},
                body: { data: [1, 2, 3] },
            }));
            const res = await fetch(server, 'GET', '/json');
            const json = await res.json();
            expect(json).toEqual({ data: [1, 2, 3] });
            await server.stop();
        });

        it('sends string body as text', async () => {
            const server = await startServer();
            server.route('GET', '/text', async () => ({
                status: 200,
                headers: { 'Content-Type': 'text/plain' },
                body: 'hello world',
            }));
            const res = await fetch(server, 'GET', '/text');
            const text = await res.text();
            expect(text).toBe('hello world');
            await server.stop();
        });
    });
});
