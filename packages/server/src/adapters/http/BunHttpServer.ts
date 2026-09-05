/**
 * Bun-specific HTTP server implementation
 *
 * Wraps Bun.serve() to provide a clean, framework-agnostic interface.
 * Supports WebSocket upgrades via ConnectionManager injection.
 */

import type { LogContext, Logger } from '@erledigen/shared';
import { pathToRegex } from '../../utils/pathUtils';
import type { ConnectionManager } from '../ws/ConnectionManager';
import type { HttpServer, HttpServerConfig } from './HttpServer';
import type { Guard, HttpRequest, HttpResponse, Middleware, RouteHandler } from './types';

interface RouteEntry {
    method: string;
    regex: RegExp;
    handler: RouteHandler;
}

let clientCounter = 0;

function generateClientId(): string {
    clientCounter++;
    return `ws_${Date.now()}_${clientCounter}`;
}

/** A trusted request ID: alphanumeric plus - and _ (UUID-safe). Anything
 *  else (or over 64 chars) is replaced -- the value is echoed into response
 *  headers and log lines, so unbounded/injected values must not flow
 *  through (see ADR-004, distributed-tracing acceptance). */
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

function resolveRequestId(headers: Record<string, string>): string {
    const incoming = headers['x-request-id'];
    if (incoming !== undefined && SAFE_REQUEST_ID.test(incoming)) return incoming;
    return crypto.randomUUID();
}

export class BunHttpServer implements HttpServer {
    private server: ReturnType<typeof Bun.serve> | null = null;
    private routes: RouteEntry[] = [];
    private guards: Guard[] = [];
    private middlewares: Middleware[] = [];
    private config: HttpServerConfig;
    private connectionManager: ConnectionManager | null = null;
    private logger: Logger | null;

    constructor(config: HttpServerConfig = {}) {
        this.logger = config.logger ?? null;
        this.config = {
            corsOrigin: config.corsOrigin || '*',
            corsHeaders: config.corsHeaders || {
                'Access-Control-Allow-Origin': config.corsOrigin || '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                // X-Client-ID lets the server tag broadcast events with their
                // origin so it can skip echoing them back to the sender.
                // Without it in the allow-list, the browser blocks the
                // preflighted POST and the client id never reaches the server.
                'Access-Control-Allow-Headers': 'Content-Type, X-Client-ID',
            },
        };
    }

    setConnectionManager(cm: ConnectionManager): void {
        this.connectionManager = cm;
    }

    route(method: string, path: string, handler: RouteHandler): void {
        this.routes.push({ method, regex: pathToRegex(path), handler });
    }

    addGuard(guard: Guard): void {
        this.guards.push(guard);
    }

    use(middleware: Middleware): void {
        this.middlewares.push(middleware);
    }

    async start(port: number): Promise<void> {
        const cm = this.connectionManager;

        if (cm) {
            this.server = Bun.serve({
                port,
                fetch: async (req: Request, server: Bun.Server<Record<string, unknown>>) => {
                    if (req.headers.get('upgrade') === 'websocket') {
                        const clientId = generateClientId();
                        server.upgrade(req, { data: { clientId } });
                        return;
                    }
                    return this.handleHttpRequest(req);
                },
                websocket: {
                    open(ws: Bun.ServerWebSocket<{ clientId: string }>) {
                        cm.add(ws.data.clientId, ws as unknown as WebSocket);
                    },
                    message(
                        ws: Bun.ServerWebSocket<{ clientId: string }>,
                        message: string | Buffer,
                    ) {
                        cm.handleMessage(ws.data.clientId, message);
                    },
                    close(ws: Bun.ServerWebSocket<{ clientId: string }>) {
                        cm.remove(ws.data.clientId);
                    },
                },
            });
        } else {
            this.server = Bun.serve({
                port,
                fetch: async (req: Request) => {
                    return this.handleHttpRequest(req);
                },
            });
        }
    }

    private async handleHttpRequest(req: Request): Promise<Response> {
        const url = new URL(req.url);
        const startedAt = performance.now();

        // CORS preflights are pure plumbing (one per cross-origin mutation)
        // -- skip them to keep the access log useful.
        if (req.method === 'OPTIONS') {
            const responseInit: ResponseInit = this.config.corsHeaders
                ? { headers: this.config.corsHeaders }
                : {};
            return new Response(null, responseInit);
        }

        const requestId = resolveRequestId(Object.fromEntries(req.headers.entries()));

        const entry = this.routes.find(r => r.method === req.method && r.regex.test(url.pathname));

        if (!entry) {
            const responseInit: ResponseInit =
                this.config.corsHeaders !== undefined
                    ? {
                          status: 404,
                          headers: { ...this.config.corsHeaders, 'X-Request-Id': requestId },
                      }
                    : { status: 404, headers: { 'X-Request-Id': requestId } };
            this.logRequest(req.method, url.pathname, 404, startedAt, requestId);
            return new Response('Not Found', responseInit);
        }

        const httpReq: HttpRequest = {
            method: req.method,
            url: req.url,
            headers: Object.fromEntries(req.headers.entries()),
            requestId,
            json: <T>() => req.json() as Promise<T>,
            text: () => req.text(),
        };

        for (const guard of this.guards) {
            const guardResponse = guard(httpReq);
            if (guardResponse !== null) {
                this.logRequest(
                    req.method,
                    url.pathname,
                    guardResponse.status,
                    startedAt,
                    requestId,
                );
                return this.toNativeResponse(guardResponse, requestId);
            }
        }

        let response = await entry.handler(httpReq);

        for (const middleware of this.middlewares) {
            response = middleware(httpReq, response);
        }

        this.logRequest(req.method, url.pathname, response.status, startedAt, requestId);
        return this.toNativeResponse(response, requestId);
    }

    /**
     * Access log for every HTTP request, including 404s and guard
     * short-circuits (rate limits) which route middleware never sees.
     * Successful requests log at debug; failures at warn so they stand
     * out on stderr even when debug logging is off.
     */
    private logRequest(
        method: string,
        path: string,
        status: number,
        startedAt: number,
        requestId: string,
    ): void {
        if (!this.logger) return;
        // One-decimal milliseconds, without the string round-trip of
        // Number(x.toFixed(1)).
        const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
        const context: LogContext = { requestId, method, path, statusCode: status, durationMs };
        if (status >= 400) {
            this.logger.warn(`${method} ${path} -> ${status}`, context);
        } else {
            this.logger.debug(`${method} ${path} -> ${status}`, context);
        }
    }

    async stop(): Promise<void> {
        if (this.server) {
            this.server.stop();
            this.server = null;
        }
    }

    getPort(): number | null {
        return this.server?.port ?? null;
    }

    private toNativeResponse(response: HttpResponse, requestId: string): Response {
        const headers = {
            ...this.config.corsHeaders,
            ...response.headers,
            'X-Request-Id': requestId,
        };

        if (typeof response.body === 'object') {
            return Response.json(response.body, {
                status: response.status,
                headers,
            });
        }

        return new Response(response.body, {
            status: response.status,
            headers,
        });
    }
}
