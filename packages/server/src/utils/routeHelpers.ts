/**
 * Shared route utilities
 *
 * Centralises the withErrorHandling wrapper and successResponse builder
 * so every route file doesn't need its own copy.
 */

import {
    type ApiResponse,
    BadRequestError,
    CONTENT_TYPE_TEXT,
    type Logger,
    RequestLogger,
} from '@erledigen/shared';
import type { HttpRequest, HttpResponse } from '../adapters/http/types';
import { negotiate } from './contentNegotiation';
import { errorToResponse } from './errorHandler';
import { extractPathParam } from './pathUtils';

export type RouteHandlerFn = (req: HttpRequest) => Promise<HttpResponse>;

/**
 * Wraps a route handler so any thrown error is caught and converted to an
 * appropriate HTTP error response instead of crashing the server.
 */
export function withErrorHandling(handler: RouteHandlerFn, logger: Logger): RouteHandlerFn {
    return async req => {
        try {
            return await handler(req);
        } catch (error) {
            // Child logger so every error line carries the request's
            // correlation ID (see ADR-004) without touching call sites.
            return errorToResponse(error, new RequestLogger(logger, { requestId: req.requestId }));
        }
    };
}

/**
 * Build a standard JSON success response wrapping `data` in ApiResponse shape.
 */
export function successResponse<T>(data: T, status = 200): HttpResponse {
    const response: ApiResponse<T> = { data };
    return { status, headers: {}, body: response };
}

/**
 * Extract a required path parameter, throwing BadRequestError if it is
 * missing (i.e. the URL did not match the route pattern). `label` is used
 * in the error message (e.g. 'project' -> 'Invalid project ID').
 */
export function requirePathParam(req: HttpRequest, pattern: string, label: string): string {
    const value = extractPathParam(req.url, pattern);
    if (!value) throw new BadRequestError(`Invalid ${label} ID`);
    return value;
}

export function respondNegotiated<T>(
    req: HttpRequest,
    data: T,
    formatAsText: (data: T) => string,
    status = 200,
): HttpResponse {
    if (negotiate(req.headers['accept']) === 'text') {
        return {
            status,
            headers: { 'Content-Type': CONTENT_TYPE_TEXT },
            body: formatAsText(data),
        };
    }
    return successResponse(data, status);
}
