/**
 * Route/OpenAPI parity tests.
 *
 * openapi/paths.ts claims "every API route documented here", but nothing
 * enforced it: six routes (trash, purge, restore, tag info, generate-all,
 * stats) had silently never been documented. This suite registers every
 * route against a recording fake server and requires the generated spec
 * to cover each registered method+path -- and, conversely, every
 * documented operation to exist on the server. inputParity.test.ts guards
 * the request schemas; this guards the surface itself.
 */

import { describe, expect, test } from 'bun:test';
import type { HttpServer } from '../adapters/http/HttpServer';
import { Container } from '../container';
import { registerAllRoutes } from '../routes/index';
import { getOpenApiJson } from './spec';

// Register against the ephemeral in-memory adapter so the test never
// touches (or creates) a database file on disk.
process.env['STORAGE_ADAPTER'] = 'memory';

interface RecordedRoute {
    method: string;
    /** Registered pattern, e.g. '/api/tasks/:id'. */
    path: string;
}

/** HttpServer double that records registrations without binding a port. */
class RecordingServer implements HttpServer {
    readonly routes: RecordedRoute[] = [];

    route(method: string, path: string): void {
        this.routes.push({ method, path });
    }

    addGuard(): void {}

    use(): void {}

    async start(): Promise<void> {}

    async stop(): Promise<void> {}

    getPort(): number | null {
        return null;
    }

    setConnectionManager(): void {}
}

/** '/api/tasks/:id' -> '/api/tasks/{id}' (the OpenAPI path form). */
function toSpecPath(pattern: string): string {
    return pattern.replace(/:(\w+)/g, '{$1}');
}

/** '/api/tasks/{id}' -> '/api/tasks/:id' (the server pattern form). */
function toPattern(specPath: string): string {
    return specPath.replace(/\{(\w+)\}/g, ':$1');
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];

describe('OpenAPI route parity', () => {
    test('every registered route is documented, and every documented route is registered', () => {
        const server = new RecordingServer();
        registerAllRoutes(server, new Container());

        const spec = getOpenApiJson() as { paths: Record<string, Record<string, unknown>> };
        const documented = spec.paths;
        expect(Object.keys(documented).length).toBeGreaterThan(0);

        // Registered -> documented: each (method, pattern) has a spec entry.
        for (const route of server.routes) {
            const pathItem = documented[toSpecPath(route.path)];
            expect(
                pathItem,
                `${route.method} ${route.path} is registered but not documented`,
            ).toBeDefined();
            const operation = pathItem?.[route.method.toLowerCase()];
            expect(operation, `${route.method} ${route.path} has no spec operation`).toBeDefined();
        }

        // Documented -> registered: each spec operation maps back to a route.
        for (const [specPath, pathItem] of Object.entries(documented)) {
            const pattern = toPattern(specPath);
            for (const method of Object.keys(pathItem)) {
                if (!HTTP_METHODS.includes(method)) continue;
                const registered = server.routes.some(
                    r => r.method.toLowerCase() === method && r.path === pattern,
                );
                expect(
                    registered,
                    `${method.toUpperCase()} ${specPath} is documented but not registered`,
                ).toBe(true);
            }
        }

        // The API surface is non-trivial; guards the test against an empty
        // registration accidentally passing both loops above.
        expect(server.routes.length).toBeGreaterThanOrEqual(30);
    });
});
