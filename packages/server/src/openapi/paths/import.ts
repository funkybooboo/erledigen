/**
 * OpenAPI path registrations: import.
 *
 * Importing this module registers these paths with the registry
 * (side-effect module; openapi/spec.ts imports it for that).
 */

import { z } from 'zod';
import { registry } from '../registry';
import { ImportQuerySchema, ImportResultSchema } from '../schemas/import';
import { rateLimitResponse, validationErrorResponse } from './common';

registry.registerPath({
    method: 'post',
    path: '/api/import',
    summary: 'Import data: restore a backup or import tasks (ADR-009)',
    operationId: 'importData',
    description:
        'The request body is the RAW source document (a file upload; not the ' +
        '{ data } envelope). format=json restores an Erledigen export ' +
        'snapshot DESTRUCTIVELY: every application table is replaced, ' +
        'preferences included. The other formats import tasks additively -- ' +
        'new rows, new ids, existing data untouched.',
    request: {
        query: ImportQuerySchema,
        body: { content: { 'text/plain': { schema: z.string() } } },
    },
    responses: {
        200: {
            description: 'Import/restore summary wrapped in the { data } envelope.',
            content: { 'application/json': { schema: ImportResultSchema } },
        },
        400: validationErrorResponse,
        429: rateLimitResponse,
    },
});
