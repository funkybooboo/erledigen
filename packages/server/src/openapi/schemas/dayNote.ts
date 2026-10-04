/**
 * DayNote entity schemas (v0.10.0) -- used for both OpenAPI documentation
 * and request validation.
 */

import { z } from 'zod';
import { registry } from '../registry';
import { IsoDate } from './common';

export const DayNoteSchema = registry.register(
    'DayNote',
    z
        .object({
            id: z.string(),
            date: IsoDate,
            notes: z.string(),
            createdAt: z.string(),
            updatedAt: z.string(),
        })
        .openapi('DayNote'),
);

/** PUT /api/day-notes/:date body. Clearing a day's note is the DELETE
 *  route's job; PUT always stores non-empty text. */
export const UpsertDayNoteSchema = registry.register(
    'UpsertDayNoteInput',
    z
        .object({
            notes: z.string().min(1),
        })
        .openapi('UpsertDayNoteInput'),
);

/** Shared `:date` path params for the day-note routes (inline object,
 *  like idParams -- not a registered component). */
export const dayNoteDateParams = z.object({ date: IsoDate });
