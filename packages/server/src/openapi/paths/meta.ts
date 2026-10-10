/**
 * OpenAPI path registrations: the OpenAPI spec endpoints themselves.
 *
 * Importing this module registers these paths with the registry
 * (side-effect module; openapi/spec.ts imports it for that).
 */

import { z } from 'zod';
import { registry } from '../registry';

// -- OpenAPI spec ---------------------------------------------------------------

registry.registerPath({
    method: 'get',
    path: '/openapi.yaml',
    summary: 'OpenAPI spec (YAML)',
    operationId: 'getOpenApiYaml',
    responses: {
        200: {
            description: 'OpenAPI 3.1 spec in YAML format',
            content: { 'application/yaml': { schema: z.string() } },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/openapi.json',
    summary: 'OpenAPI spec (JSON)',
    operationId: 'getOpenApiJson',
    responses: {
        200: {
            description: 'OpenAPI 3.1 spec in JSON format',
            content: { 'application/json': { schema: z.object({}) } },
        },
    },
});

// -- API explorer (ADR-024) ----------------------------------------------------

registry.registerPath({
    method: 'get',
    path: '/api/openapi.json',
    summary: 'OpenAPI spec (JSON), /api/* alias',
    description:
        'Same document as /openapi.json, on the path the prod edge ' +
        'proxy routes to the API server (consumed by the Swagger UI at /api/docs).',
    operationId: 'getOpenApiJsonAlias',
    responses: {
        200: {
            description: 'OpenAPI 3.1 spec in JSON format',
            content: { 'application/json': { schema: z.object({}) } },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/docs',
    summary: 'Swagger UI: the API explorer',
    description:
        'Serves the Swagger UI page rendered from the OpenAPI spec ' +
        '(vendored assets; works offline).',
    operationId: 'getApiDocs',
    responses: {
        200: {
            description: 'Swagger UI HTML page',
            content: { 'text/html': { schema: z.string() } },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/docs/assets/{file}',
    summary: 'Swagger UI static asset',
    description: 'Whitelisted by exact file name.',
    operationId: 'getApiDocsAsset',
    request: { params: z.object({ file: z.string() }) },
    responses: {
        200: {
            description: 'The vendored asset (JS or CSS)',
            content: { 'text/plain': { schema: z.string() } },
        },
        404: {
            description: 'Unknown asset name',
            content: { 'text/plain': { schema: z.string() } },
        },
    },
});
