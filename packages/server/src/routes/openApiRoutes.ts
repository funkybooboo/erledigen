/**
 * OpenAPI spec routes
 *
 * Serves the generated OpenAPI 3.1 spec at /openapi.yaml and /openapi.json.
 * The spec is generated from Zod schemas at startup and cached in memory.
 */

import type { HttpServer } from '../adapters/http/HttpServer';
import type { HttpResponse } from '../adapters/http/types';
import { getOpenApiJson, getOpenApiYaml } from '../openapi/spec';

export function registerOpenApiRoutes(server: HttpServer): void {
    server.route('GET', '/openapi.yaml', async (): Promise<HttpResponse> => {
        return {
            status: 200,
            headers: { 'Content-Type': 'application/yaml; charset=utf-8' },
            body: getOpenApiYaml(),
        };
    });

    server.route('GET', '/openapi.json', async (): Promise<HttpResponse> => {
        return {
            status: 200,
            headers: {},
            body: getOpenApiJson(),
        };
    });

    // /api/* alias of the spec: the prod edge proxy routes only /api/*
    // and /ws to the API server, so browser-side consumers (the Swagger
    // UI at /api/docs) need the spec on a proxied path (ADR-024).
    server.route('GET', '/api/openapi.json', async (): Promise<HttpResponse> => {
        return {
            status: 200,
            headers: {},
            body: getOpenApiJson(),
        };
    });
}
