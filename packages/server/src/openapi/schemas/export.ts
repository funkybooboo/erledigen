/**
 * OpenAPI schemas: export.
 *
 * ExportQuerySchema validates GET /api/export's query params;
 * ExportSnapshotSchema documents the canonical backup format
 * (ADR-008) so /openapi.json is the format's reference.
 */

import { DEFAULT_CSV_COLUMNS, EXPORT_FORMATS } from '@erledigen/shared';
import { z } from 'zod';
import { registry } from '../registry';
import { ProjectSchema } from './project';
import { RecurringTaskSchema } from './recurringTask';
import { SomeDayGroupSchema } from './someDayGroup';
import { TaskSchema } from './task';
import { UserPreferencesSchema } from './userPreferences';

/** Canonical export snapshot (ADR-008) -- the stable JSON backup format. */
export const ExportSnapshotSchema = registry.register(
    'ExportSnapshot',
    z.object({
        format: z.literal('erledigen-export').describe('Format discriminator'),
        version: z.literal(1).describe('Snapshot schema version (see ADR-008)'),
        exportedAt: z.string().describe('ISO 8601 UTC timestamp of the export'),
        tasks: z.array(TaskSchema).describe('Every task, including soft-deleted (trash) rows'),
        someDayGroups: z.array(SomeDayGroupSchema),
        projects: z.array(ProjectSchema),
        recurringTasks: z.array(RecurringTaskSchema),
        userPreferences: UserPreferencesSchema,
    }),
);

export const ExportQuerySchema = z.object({
    format: z
        .enum(EXPORT_FORMATS)
        .default('json')
        .describe('Export format: json = canonical lossless backup; csv/md/ics are task views'),
    columns: z
        .string()
        .refine(
            value =>
                value.split(',').every(c => (DEFAULT_CSV_COLUMNS as readonly string[]).includes(c)),
            {
                message: `columns must be a comma-separated subset of: ${DEFAULT_CSV_COLUMNS.join(', ')}`,
            },
        )
        .optional()
        .describe('CSV only: comma-separated column subset (ignored by other formats)'),
});
