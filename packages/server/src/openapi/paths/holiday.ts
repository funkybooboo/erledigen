/**
 * OpenAPI path registrations: holidays (v0.9.0).
 *
 * Importing this module registers these paths with the registry
 * (side-effect module; openapi/spec.ts imports it for that).
 */

import { z } from 'zod';
import { registry } from '../registry';
import {
    CreateHolidaySchema,
    HolidayImportUrlSchema,
    HolidaySchema,
    UpdateHolidaySchema,
} from '../schemas/holiday';
import {
    deleteSuccessResponse,
    idParams,
    notFoundResponse,
    validationErrorResponse,
} from './common';

// -- Holidays ---------------------------------------------------------------

const holidayDataResponse = {
    description: 'Holiday',
    content: {
        'application/json': { schema: z.object({ data: HolidaySchema }) },
    },
} as const;

registry.registerPath({
    method: 'get',
    path: '/api/holidays',
    summary: 'List holidays',
    operationId: 'listHolidays',
    responses: {
        200: {
            description: 'Holidays in calendar order (date, then name)',
            content: {
                'application/json': { schema: z.object({ data: z.array(HolidaySchema) }) },
                'text/plain': { schema: z.string() },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/api/holidays',
    summary: 'Create a holiday',
    operationId: 'createHoliday',
    request: {
        body: {
            required: true,
            content: { 'application/json': { schema: CreateHolidaySchema } },
        },
    },
    responses: {
        201: holidayDataResponse,
        400: validationErrorResponse,
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/holidays/{id}',
    summary: 'Get a holiday by ID',
    operationId: 'getHoliday',
    request: { params: idParams },
    responses: {
        200: holidayDataResponse,
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'put',
    path: '/api/holidays/{id}',
    summary: 'Update a holiday',
    operationId: 'updateHoliday',
    request: {
        params: idParams,
        body: {
            required: true,
            content: { 'application/json': { schema: UpdateHolidaySchema } },
        },
    },
    responses: {
        200: holidayDataResponse,
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'delete',
    path: '/api/holidays/{id}',
    summary: 'Delete a holiday',
    operationId: 'deleteHoliday',
    request: { params: idParams },
    responses: {
        200: deleteSuccessResponse('Holiday deleted'),
        404: notFoundResponse,
    },
});

// -- Holiday .ics import -----------------------------------------------------

/** Outcome shape shared by both import modes (raw text or URL). */
const holidayImportResult = {
    description: 'Holidays created by the import',
    content: {
        'application/json': {
            schema: z.object({
                data: z.object({
                    holidays: z.array(HolidaySchema),
                    skipped: z.number(),
                    warnings: z.array(
                        z.object({ source: z.number().optional(), message: z.string() }),
                    ),
                }),
            }),
        },
    },
} as const;

registry.registerPath({
    method: 'post',
    path: '/api/holidays/import',
    summary: 'Import holidays from an .ics document',
    description:
        'Either send the raw .ics document as the request body, or a JSON body ' +
        '{ "url": ... } to have the server fetch a remote calendar (http/https). ' +
        'Duplicate (date, name) pairs are skipped, so re-importing a feed adds nothing.',
    operationId: 'importHolidays',
    request: {
        body: {
            required: true,
            content: {
                'application/json': { schema: HolidayImportUrlSchema },
                'text/plain': { schema: z.string() },
            },
        },
    },
    responses: {
        200: holidayImportResult,
        400: validationErrorResponse,
    },
});
