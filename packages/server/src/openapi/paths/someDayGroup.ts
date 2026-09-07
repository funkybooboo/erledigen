/**
 * OpenAPI path registrations: Someday groups.
 *
 * Importing this module registers these paths with the registry
 * (side-effect module; openapi/spec.ts imports it for that).
 */

import { z } from 'zod';
import { registry } from '../registry';
import {
    CreateSomeDayGroupSchema,
    SomeDayGroupSchema,
    UpdateSomeDayGroupSchema,
} from '../schemas/someDayGroup';
import {
    deleteSuccessResponse,
    idParams,
    notFoundResponse,
    validationErrorResponse,
} from './common';

// -- Someday Groups -------------------------------------------------------------

const groupDataResponse = {
    description: 'Someday group',
    content: {
        'application/json': { schema: z.object({ data: SomeDayGroupSchema }) },
    },
} as const;

registry.registerPath({
    method: 'get',
    path: '/api/someday-groups',
    summary: 'List Someday groups',
    operationId: 'listSomeDayGroups',
    responses: {
        200: {
            description: 'List of Someday groups',
            content: {
                'application/json': { schema: z.object({ data: z.array(SomeDayGroupSchema) }) },
                'text/plain': { schema: z.string() },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/api/someday-groups',
    summary: 'Create a Someday group',
    operationId: 'createSomeDayGroup',
    request: {
        body: {
            required: true,
            content: { 'application/json': { schema: CreateSomeDayGroupSchema } },
        },
    },
    responses: {
        201: groupDataResponse,
        400: validationErrorResponse,
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/someday-groups/{id}',
    summary: 'Get a Someday group by ID',
    operationId: 'getSomeDayGroup',
    request: { params: idParams },
    responses: {
        200: groupDataResponse,
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'put',
    path: '/api/someday-groups/{id}',
    summary: 'Update a Someday group',
    operationId: 'updateSomeDayGroup',
    request: {
        params: idParams,
        body: {
            required: true,
            content: { 'application/json': { schema: UpdateSomeDayGroupSchema } },
        },
    },
    responses: {
        200: groupDataResponse,
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'delete',
    path: '/api/someday-groups/{id}',
    summary: 'Delete a Someday group',
    operationId: 'deleteSomeDayGroup',
    request: { params: idParams },
    responses: {
        200: deleteSuccessResponse('Someday group deleted'),
        404: notFoundResponse,
    },
});
