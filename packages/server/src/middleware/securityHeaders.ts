/**
 * Security headers middleware
 *
 * Adds security-related HTTP headers to every response.
 */

import type { Middleware } from '../adapters/http/types';

/**
 * Middleware that injects security headers into every response.
 *
 * Headers applied:
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Content-Security-Policy: default-src 'none'; frame-ancestors 'none'
 *   (a handler may set its own CSP -- e.g. the API docs page, which
 *   needs same-origin scripts and styles; the default fills the rest)
 * - Strict-Transport-Security (production only)
 */
export function createSecurityHeadersMiddleware(nodeEnv: string): Middleware {
    return (_req, res) => {
        const headers: Record<string, string> = {
            ...res.headers,
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Content-Security-Policy':
                res.headers['Content-Security-Policy'] ??
                "default-src 'none'; frame-ancestors 'none'",
        };

        if (nodeEnv === 'production') {
            headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains';
        }

        return { ...res, headers };
    };
}
