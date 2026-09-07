/**
 * OpenAPI schemas: import.
 *
 * ImportQuerySchema validates POST /api/import's query params;
 * ImportResultSchema documents the response shape (ADR-009).
 */

import { CSV_IMPORT_FIELDS, IMPORT_FORMATS } from '@erledigen/shared';
import { z } from 'zod';
import { registry } from '../registry';
import { ErrorResponseSchema } from './common';

/** Result summary for POST /api/import (ADR-009). */
export const ImportResultSchema = registry.register(
    'ImportResult',
    z.object({
        mode: z.enum(['restore', 'import']),
        created: z.number().describe('Tasks created (additive import, sub-tasks included)'),
        restored: z
            .object({
                tasks: z.number(),
                someDayGroups: z.number(),
                projects: z.number(),
                recurringTasks: z.number(),
                preferences: z.literal(true),
            })
            .nullable()
            .describe('Entity counts restored from a JSON snapshot (restore mode)'),
        backupPath: z
            .string()
            .nullable()
            .describe('Server-side pre-restore backup path (file-backed storage only)'),
        warnings: z
            .array(z.object({ source: z.number().optional(), message: z.string() }))
            .describe('Non-fatal issues: skipped rows and conversions (capped)'),
    }),
);

/**
 * Column mapping for the generic CSV format: comma-separated
 * `field:columnIndex` pairs, e.g. `mapping=text:0,date:2,tags:5`.
 * Index-based so header names with commas or colons cannot break it;
 * omitted fields import as empty. Without a mapping the columns are
 * auto-detected from the header row.
 */
const CsvMappingQuerySchema = z
    .string()
    .refine(
        value =>
            value.split(',').every(pair => {
                const [field, index] = pair.split(':');
                return (
                    (CSV_IMPORT_FIELDS as readonly string[]).includes(field ?? '') &&
                    /^\d+$/.test(index ?? '')
                );
            }),
        {
            message: `mapping must be comma-separated field:columnIndex pairs with fields from: ${CSV_IMPORT_FIELDS.join(', ')}`,
        },
    )
    .optional();

export const ImportQuerySchema = z.object({
    format: z
        .enum(IMPORT_FORMATS)
        .describe(
            "Import source: 'json' restores an Erledigen backup (destructive); the rest import tasks additively",
        ),
    mapping: CsvMappingQuerySchema.describe('CSV only: column mapping (field:columnIndex pairs)'),
});

/** Used by the route to surface import errors with issue details. */
export const ImportErrorResponseSchema = ErrorResponseSchema;
