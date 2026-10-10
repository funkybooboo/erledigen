/**
 * Swagger UI routes (ADR-024): the API explorer.
 *
 * Serves the vendored Swagger UI (see src/docs/assets/) at /api/docs,
 * rendered from the OpenAPI spec at /api/openapi.json. The whole page
 * lives under /api/* because the prod edge proxy (deploy/Caddyfile)
 * routes only /api/* and /ws to the API server -- the root-level
 * /openapi.json is not reachable from a browser behind the proxy.
 *
 * Assets are whitelisted by exact name: the request never becomes a
 * filesystem path, so traversal sequences cannot name anything that is
 * not on the list. The files are read relative to the running entry
 * file (Bun.main: src/index.ts in development, dist/index.js in the
 * production image), where the build places them at docs/assets --
 * the same convention as the SQL migrations it copies to dist/.
 */

import { dirname } from 'node:path';
import type { HttpServer } from '../adapters/http/HttpServer';
import type { HttpResponse } from '../adapters/http/types';
import { extractPathParam } from '../utils/pathUtils';

interface Asset {
    contentType: string;
}

/** Exact-name whitelist; the key is what the URL may request. */
const ASSETS: Record<string, Asset> = {
    'swagger-ui-bundle.js': { contentType: 'text/javascript; charset=utf-8' },
    'swagger-ui.css': { contentType: 'text/css; charset=utf-8' },
    'init.js': { contentType: 'text/javascript; charset=utf-8' },
};

/**
 * The docs page sets its own CSP: the global middleware default
 * (`default-src 'none'`) would block the UI's same-origin scripts,
 * stylesheet, spec fetch, and inline runtime styles. frame-ancestors
 * keeps the anti-clickjacking stance of the default policy.
 */
const PAGE_CSP = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
].join('; ');

const DOCS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,">
<title>Erledigen API</title>
<link rel="stylesheet" href="/api/docs/assets/swagger-ui.css">
</head>
<body>
<div id="swagger-ui"></div>
<script src="/api/docs/assets/swagger-ui-bundle.js"></script>
<script src="/api/docs/assets/init.js"></script>
</body>
</html>`;

export function registerDocsRoutes(server: HttpServer): void {
    server.route('GET', '/api/docs', async (): Promise<HttpResponse> => {
        return {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Content-Security-Policy': PAGE_CSP,
            },
            body: DOCS_HTML,
        };
    });

    server.route('GET', '/api/docs/assets/:file', async (req): Promise<HttpResponse> => {
        const name = extractPathParam(req.url, '/api/docs/assets/:file');
        const asset = name === null ? undefined : ASSETS[name];
        if (!asset) {
            return { status: 404, headers: {}, body: 'Not Found' };
        }
        const text = await Bun.file(`${dirname(Bun.main)}/docs/assets/${name}`).text();
        return {
            status: 200,
            headers: {
                'Content-Type': asset.contentType,
                // The file names do not hash with releases; one day
                // covers a browsing session without serving a stale
                // UI for weeks after an upgrade.
                'Cache-Control': 'public, max-age=86400',
            },
            body: text,
        };
    });
}
