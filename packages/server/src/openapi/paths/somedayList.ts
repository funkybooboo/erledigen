/**
 * OpenAPI path registrations: Someday lists.
 *
 * Importing this module registers these paths with the registry
 * (side-effect module; openapi/spec.ts imports it for that).
 */

import { z } from 'zod';
import { registry } from '../registry';
import {
    CreateSomedayListSchema,
    SomedayListSchema,
    UpdateSomedayListSchema,
} from '../schemas/somedayList';
import {
    deleteSuccessResponse,
    idParams,
    notFoundResponse,
    validationErrorResponse,
} from './common';

// -- Someday Lists ----------------------------------------------------------

const listDataResponse = {
    description: 'Someday list',
    content: {
        'application/json': { schema: z.object({ data: SomedayListSchema }) },
    },
} as const;

registry.registerPath({
    method: 'get',
    path: '/api/someday-lists',
    summary: 'List Someday lists',
    operationId: 'listSomedayLists',
    responses: {
        200: {
            description: 'List of Someday lists',
            content: {
                'application/json': { schema: z.object({ data: z.array(SomedayListSchema) }) },
                'text/plain': { schema: z.string() },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/api/someday-lists',
    summary: 'Create a Someday list',
    operationId: 'createSomedayList',
    request: {
        body: {
            required: true,
            content: { 'application/json': { schema: CreateSomedayListSchema } },
        },
    },
    responses: {
        201: listDataResponse,
        400: validationErrorResponse,
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/someday-lists/{id}',
    summary: 'Get a Someday list by ID',
    operationId: 'getSomedayList',
    request: { params: idParams },
    responses: {
        200: listDataResponse,
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'put',
    path: '/api/someday-lists/{id}',
    summary: 'Update a Someday list',
    operationId: 'updateSomedayList',
    request: {
        params: idParams,
        body: {
            required: true,
            content: { 'application/json': { schema: UpdateSomedayListSchema } },
        },
    },
    responses: {
        200: listDataResponse,
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'delete',
    path: '/api/someday-lists/{id}',
    summary: 'Delete a Someday list',
    operationId: 'deleteSomedayList',
    request: { params: idParams },
    responses: {
        200: deleteSuccessResponse('Someday list deleted'),
        404: notFoundResponse,
    },
});
