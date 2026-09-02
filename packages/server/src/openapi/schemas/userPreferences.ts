/**
 * UserPreferences entity schemas.
 */

import { isValidTimeZone } from '@erledigen/shared';
import { z } from 'zod';
import { registry } from '../registry';

const TagKindSchema = z.object({
    id: z.string(),
    name: z.string(),
    behavior: z.enum(['single', 'multiple']),
    prefix: z.string().nullable(),
    sortOrder: z.number().int(),
    color: z.string().nullable(),
});

const ActiveFiltersSchema = z.object({
    tags: z.array(z.string()),
    showCompleted: z.boolean(),
});

export const UserPreferencesSchema = registry.register(
    'UserPreferences',
    z
        .object({
            id: z.literal('default'),
            theme: z.enum(['light', 'dark', 'system']),
            locale: z.string(),
            someDayPanelWidth: z.number().int(),
            someDayPanelCollapsed: z.boolean(),
            someDayPanelLastOpenWidth: z.number().int(),
            rolloverEnabled: z.boolean(),
            showEmptyDays: z.boolean(),
            deleteConfirmation: z.enum(['instant', 'confirm']),
            activeFilters: ActiveFiltersSchema,
            tagKinds: z.array(TagKindSchema),
            tagKindMap: z.record(z.string(), z.string()),
            timeFormat: z.enum(['12h', '24h']),
            timezone: z.string().nullable(),
            updatedAt: z.string(),
        })
        .openapi('UserPreferences'),
);

export const UpdateUserPreferencesSchema = registry.register(
    'UpdateUserPreferencesInput',
    z
        .object({
            theme: z.enum(['light', 'dark', 'system']).optional(),
            locale: z.string().optional(),
            someDayPanelWidth: z.number().int().min(0).max(800).optional(),
            someDayPanelCollapsed: z.boolean().optional(),
            someDayPanelLastOpenWidth: z.number().int().optional(),
            rolloverEnabled: z.boolean().optional(),
            showEmptyDays: z.boolean().optional(),
            deleteConfirmation: z.enum(['instant', 'confirm']).optional(),
            activeFilters: ActiveFiltersSchema.optional(),
            tagKinds: z.array(TagKindSchema).optional(),
            tagKindMap: z.record(z.string(), z.string()).optional(),
            // timeFormat/timezone were once missing here: parseBody strips
            // unknown keys, so PATCH silently discarded the user's clock
            // format and timezone on every save (the client kept them in
            // memory for the session, which masked it until reload).
            timeFormat: z.enum(['12h', '24h']).optional(),
            timezone: z
                .string()
                // Reject at the door: a stored bad zone would throw in
                // NativeDateProvider.setTimeZone on every client load.
                .refine(isValidTimeZone, { message: 'Unknown IANA timezone' })
                .nullable()
                .optional(),
        })
        .openapi('UpdateUserPreferencesInput'),
);
