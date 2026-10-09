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

const TagColorSchema = z.enum(['coral', 'amber', 'lime', 'sage', 'sky', 'violet', 'rose', 'slate']);

const ActiveFiltersSchema = z.object({
    tags: z.array(z.string()),
    showCompleted: z.boolean(),
    sortMode: z.enum(['manual', 'priority']),
    dateFrom: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
    dateTo: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
});

export const UserPreferencesSchema = registry.register(
    'UserPreferences',
    z
        .object({
            id: z.literal('default'),
            theme: z.enum(['light', 'dark', 'system']),
            accent: z.enum(['blue', 'coral', 'amber']),
            locale: z.string(),
            someDayPanelWidth: z.number().int(),
            someDayPanelCollapsed: z.boolean(),
            someDayPanelLastOpenWidth: z.number().int(),
            rolloverEnabled: z.boolean(),
            rolloverTriggerTime: z.enum(['midnight', '9am', 'manual']),
            showEmptyDays: z.boolean(),
            deleteConfirmation: z.enum(['instant', 'confirm']),
            activeFilters: ActiveFiltersSchema,
            tagKinds: z.array(TagKindSchema),
            tagKindMap: z.record(z.string(), z.string()),
            tagColors: z.record(z.string(), TagColorSchema),
            timeFormat: z.enum(['12h', '24h']),
            fontSize: z.enum(['small', 'medium', 'large']),
            rowDensity: z.enum(['compact', 'comfortable']),
            completionAnimation: z.enum(['flash', 'none']),
            persistActiveFilters: z.boolean(),
            shortcutOverrides: z.record(z.string(), z.array(z.string().min(1))),
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
            accent: z.enum(['blue', 'coral', 'amber']).optional(),
            locale: z.string().optional(),
            someDayPanelWidth: z.number().int().min(0).max(800).optional(),
            someDayPanelCollapsed: z.boolean().optional(),
            someDayPanelLastOpenWidth: z.number().int().optional(),
            rolloverEnabled: z.boolean().optional(),
            rolloverTriggerTime: z.enum(['midnight', '9am', 'manual']).optional(),
            showEmptyDays: z.boolean().optional(),
            deleteConfirmation: z.enum(['instant', 'confirm']).optional(),
            // PATCH replaces activeFilters as a whole object (repo merge
            // semantics); the client always sends every field. A third party
            // PATCHing a partial object gets a 400, same as before for
            // tags/showCompleted.
            activeFilters: ActiveFiltersSchema.optional(),
            tagKinds: z.array(TagKindSchema).optional(),
            tagKindMap: z.record(z.string(), z.string()).optional(),
            // Tag color overrides: keys are free-form tag names, values
            // must be known palette ids -- an unknown color would render
            // no chip color at all, so it is rejected at the door.
            tagColors: z.record(z.string(), TagColorSchema).optional(),
            // timeFormat/timezone were once missing here: parseBody strips
            // unknown keys, so PATCH silently discarded the user's clock
            // format and timezone on every save (the client kept them in
            // memory for the session, which masked it until reload).
            timeFormat: z.enum(['12h', '24h']).optional(),
            fontSize: z.enum(['small', 'medium', 'large']).optional(),
            rowDensity: z.enum(['compact', 'comfortable']).optional(),
            completionAnimation: z.enum(['flash', 'none']).optional(),
            persistActiveFilters: z.boolean().optional(),
            // The ids and binding grammar live in the CLIENT's registry;
            // the server persists the shape and replays it verbatim
            // (structure-validated: id -> non-empty binding strings).
            shortcutOverrides: z.record(z.string(), z.array(z.string().min(1))).optional(),
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
