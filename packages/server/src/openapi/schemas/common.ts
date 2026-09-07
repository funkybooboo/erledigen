/**
 * Shared schema primitives and the ErrorResponse schema.
 */

import { isValidTimeString } from '@erledigen/shared';
import { z } from 'zod';
import { registry } from '../registry';

/** ISO 8601 date string (YYYY-MM-DD) */
export const IsoDate = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .openapi({ description: 'ISO 8601 date (YYYY-MM-DD)', example: '2025-01-15' });

/** Time string in HH:MM format (00:00-23:59). The bounds live in the
 *  shared isValidTimeString law -- one definition for client and server. */
export const HhMmTime = z
    .string()
    .refine(isValidTimeString, 'Must be HH:MM within 00:00-23:59')
    .openapi({ description: 'Time in HH:MM format', example: '09:00' });

export const ErrorResponseSchema = registry.register(
    'ErrorResponse',
    z
        .object({
            error: z.string().openapi({ description: 'Human-readable error message' }),
            code: z
                .enum([
                    'VALIDATION_ERROR',
                    'NOT_FOUND',
                    'BAD_REQUEST',
                    'CONFLICT',
                    'UNAUTHORIZED',
                    'FORBIDDEN',
                    'INTERNAL_SERVER_ERROR',
                    'RATE_LIMIT_EXCEEDED',
                ])
                .openapi({ description: 'Machine-readable error code' }),
            details: z
                .unknown()
                .optional()
                .openapi({ description: 'Optional structured validation details' }),
        })
        .openapi('ErrorResponse'),
);
