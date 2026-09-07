/**
 * OpenAPI path registrations: export.
 *
 * Importing this module registers these paths with the registry
 * (side-effect module; openapi/spec.ts imports it for that).
 */

import { z } from 'zod';
import { registry } from '../registry';
import { ExportQuerySchema, ExportSnapshotSchema } from '../schemas/export';
import { rateLimitResponse, validationErrorResponse } from './common';

// -- Export -----------------------------------------------------------------------

registry.registerPath({
    method: 'get',
    path: '/api/export',
    summary: 'Export data as a downloadable document (ADR-008)',
    operationId: 'exportData',
    request: {
        query: ExportQuerySchema,
    },
    responses: {
        200: {
            description:
                'Export document. The response is the RAW document (not wrapped in ' +
                'the usual { data } envelope) with a Content-Disposition ' +
                'attachment filename. JSON is the canonical lossless backup ' +
                'including the trash; CSV/Markdown/iCal are views of the active ' +
                'task list.',
            content: {
                'application/json': { schema: ExportSnapshotSchema },
                'text/csv': { schema: z.string() },
                'text/markdown': { schema: z.string() },
                'text/calendar': { schema: z.string() },
            },
        },
        400: validationErrorResponse,
        429: rateLimitResponse,
    },
});
