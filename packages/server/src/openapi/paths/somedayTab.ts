/**
 * OpenAPI path registrations: Someday tabs.
 *
 * Importing this module registers these paths with the registry
 * (side-effect module; openapi/spec.ts imports it for that).
 */

import { z } from 'zod';
import { registry } from '../registry';
import {
    CreateSomedayTabSchema,
    SomedayTabSchema,
    UpdateSomedayTabSchema,
} from '../schemas/somedayTab';
import {
    deleteSuccessResponse,
    idParams,
    notFoundResponse,
    validationErrorResponse,
} from './common';

// -- Someday Tabs ---------------------------------------------------------

const tabDataResponse = {
    description: 'Someday tab',
    content: {
        'application/json': { schema: z.object({ data: SomedayTabSchema }) },
    },
} as const;

registry.registerPath({
    method: 'get',
    path: '/api/someday-tabs',
    summary: 'List Someday tabs',
    operationId: 'listSomedayTabs',
    responses: {
        200: {
            description: 'List of Someday tabs',
            content: {
                'application/json': { schema: z.object({ data: z.array(SomedayTabSchema) }) },
                'text/plain': { schema: z.string() },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/api/someday-tabs',
    summary: 'Create a Someday tab',
    operationId: 'createSomedayTab',
    request: {
        body: {
            required: true,
            content: { 'application/json': { schema: CreateSomedayTabSchema } },
        },
    },
    responses: {
        201: tabDataResponse,
        400: validationErrorResponse,
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/someday-tabs/{id}',
    summary: 'Get a Someday tab by ID',
    operationId: 'getSomedayTab',
    request: { params: idParams },
    responses: {
        200: tabDataResponse,
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'put',
    path: '/api/someday-tabs/{id}',
    summary: 'Update a Someday tab',
    operationId: 'updateSomedayTab',
    request: {
        params: idParams,
        body: {
            required: true,
            content: { 'application/json': { schema: UpdateSomedayTabSchema } },
        },
    },
    responses: {
        200: tabDataResponse,
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'delete',
    path: '/api/someday-tabs/{id}',
    summary: 'Delete a Someday tab (the default tab cannot be deleted)',
    operationId: 'deleteSomedayTab',
    request: { params: idParams },
    responses: {
        200: deleteSuccessResponse('Someday tab deleted'),
        400: validationErrorResponse,
        404: notFoundResponse,
    },
});
