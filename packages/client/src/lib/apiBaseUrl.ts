/**
 * Resolve the API origin the browser should talk to.
 *
 * `VITE_API_URL` is inlined into the client bundle at build time by Vite.
 * Two deployment shapes exist:
 *
 *   - Split origins (dev, or a dedicated API domain): the variable is an
 *     absolute origin, e.g. `http://localhost:4000`.
 *   - Single origin (the prod stack): the variable is the EMPTY string.
 *     The reverse proxy (deploy/Caddyfile) serves `/api` and `/ws` next to
 *     the app, so the API is simply "this page's origin" -- no host or
 *     domain needs to be baked into the image.
 *
 * The localhost fallback only applies outside the browser (SSR), where a
 * relative URL would be meaningless; no API call is made during SSR today,
 * so it exists purely to keep `new URL()` from throwing.
 */

/**
 * Map the configured value to a usable absolute origin.
 */
export function resolveApiBaseUrl(configured: string): string {
    if (configured) return configured;
    if (typeof window !== 'undefined') return window.location.origin;
    return 'http://localhost:4000';
}
