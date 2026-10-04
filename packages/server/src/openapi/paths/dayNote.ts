/**
 * OpenAPI path registrations: day notes (v0.10.0).
 *
 * Importing this module registers these paths with the registry
 * (side-effect module; openapi/spec.ts imports it for that).
 */

import { z } from 'zod';
import { registry } from '../registry';
import { DayNoteSchema, dayNoteDateParams, UpsertDayNoteSchema } from '../schemas/dayNote';
import { deleteSuccessResponse, notFoundResponse, validationErrorResponse } from './common';

const dayNoteDataResponse = {
    description: 'Day note',
    content: {
        'application/json': { schema: z.object({ data: DayNoteSchema }) },
    },
} as const;

registry.registerPath({
    method: 'get',
    path: '/api/day-notes',
    summary: 'List day notes',
    operationId: 'listDayNotes',
    responses: {
        200: {
            description: 'Every day note, in date order',
            content: {
                'application/json': { schema: z.object({ data: z.array(DayNoteSchema) }) },
                'text/plain': { schema: z.string() },
            },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/day-notes/{date}',
    summary: 'Get one day note by date',
    operationId: 'getDayNote',
    request: { params: dayNoteDateParams },
    responses: {
        200: dayNoteDataResponse,
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'put',
    path: '/api/day-notes/{date}',
    summary: 'Create or replace a day note',
    description:
        'Upsert: stores the note for the date, creating the row on first ' +
        'write. Clearing a note is the DELETE route.',
    operationId: 'upsertDayNote',
    request: {
        params: dayNoteDateParams,
        body: {
            required: true,
            content: { 'application/json': { schema: UpsertDayNoteSchema } },
        },
    },
    responses: {
        200: dayNoteDataResponse,
        400: validationErrorResponse,
    },
});

registry.registerPath({
    method: 'delete',
    path: '/api/day-notes/{date}',
    summary: 'Delete a day note',
    operationId: 'deleteDayNote',
    request: { params: dayNoteDateParams },
    responses: {
        200: deleteSuccessResponse('Day note deleted'),
        404: notFoundResponse,
    },
});
