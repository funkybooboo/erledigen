/**
 * OpenAPI path registrations: reusable response and param shapes.
 *
 * Importing this module registers these paths with the registry
 * (side-effect module; openapi/spec.ts imports it for that).
 */

import { z } from 'zod';
import { ErrorResponseSchema } from '../schemas/common';

// -- Reusable response configs --------------------------------------------------

export const notFoundResponse = {
    description: 'Resource not found',
    content: { 'application/json': { schema: ErrorResponseSchema } },
} as const;

export const validationErrorResponse = {
    description: 'Validation failed',
    content: { 'application/json': { schema: ErrorResponseSchema } },
} as const;

export const rateLimitResponse = {
    description: 'Rate limit exceeded',
    content: { 'application/json': { schema: ErrorResponseSchema } },
} as const;

// Reusable request param / response shapes

/** `{ id: string }` path param object shared by every /:id route. */
export const idParams = z.object({ id: z.string() });

/** Standard `{ data: { success: true } }` body for DELETE responses. */
export const deleteSuccessResponse = (description: string) =>
    ({
        description,
        content: {
            'application/json': { schema: z.object({ data: z.object({ success: z.boolean() }) }) },
        },
    }) as const;
