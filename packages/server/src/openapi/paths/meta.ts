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
