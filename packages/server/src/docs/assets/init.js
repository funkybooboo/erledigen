/**
 * Swagger UI runtime initializer for /api/docs (ADR-024).
 *
 * Loaded as a same-origin asset so the page CSP needs no
 * 'unsafe-inline' for scripts. The spec URL is the /api/... alias:
 * the prod edge proxy (deploy/Caddyfile) routes only /api/* and /ws
 * to the API server, so the root-level /openapi.json is not
 * reachable from a browser behind the proxy.
 */
window.addEventListener('load', function () {
    window.ui = window.SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        docExpansion: 'list',
        tryItOutEnabled: true,
    });
});