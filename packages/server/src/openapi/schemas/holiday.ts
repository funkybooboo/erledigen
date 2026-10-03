/**
 * Holiday entity schemas (v0.9.0) -- used for both OpenAPI documentation
 * and request validation.
 */

import { z } from 'zod';
import { registry } from '../registry';
import { IsoDate } from './common';

/** Holiday names share the task text ceiling so an imported VEVENT
 *  summary never truncates (the .ics import maps summaries 1:1). */
export const HolidaySchema = registry.register(
    'Holiday',
    z
        .object({
            id: z.string(),
            name: z.string().min(1).max(500),
            date: IsoDate,
            createdAt: z.string(),
        })
        .openapi('Holiday'),
);

export const CreateHolidaySchema = registry.register(
    'CreateHolidayInput',
    z
        .object({
            name: z.string().min(1).max(500),
            date: IsoDate,
        })
        .openapi('CreateHolidayInput'),
);

export const UpdateHolidaySchema = registry.register(
    'UpdateHolidayInput',
    z
        .object({
            name: z.string().min(1).max(500).optional(),
            date: IsoDate.optional(),
        })
        .openapi('UpdateHolidayInput'),
);

/** POST /api/holidays/import with a JSON body: fetch a remote .ics
 *  feed server-side (avoids the browser CORS wall). Without a JSON
 *  body the route reads the raw .ics text instead. */
export const HolidayImportUrlSchema = registry.register(
    'HolidayImportUrlInput',
    z
        .object({
            url: z
                .string()
                .url()
                .refine(value => value.startsWith('http://') || value.startsWith('https://'), {
                    message: 'Only http(s) URLs can be imported',
                }),
        })
        .openapi('HolidayImportUrlInput'),
);
