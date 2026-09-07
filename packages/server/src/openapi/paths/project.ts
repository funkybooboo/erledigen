/**
 * OpenAPI path registrations: projects.
 *
 * Importing this module registers these paths with the registry
 * (side-effect module; openapi/spec.ts imports it for that).
 */

import { z } from 'zod';
import { registry } from '../registry';
import { CreateProjectSchema, ProjectSchema, UpdateProjectSchema } from '../schemas/project';
import {
    deleteSuccessResponse,
    idParams,
    notFoundResponse,
    validationErrorResponse,
} from './common';

// -- Projects -------------------------------------------------------------------

const projectDataResponse = {
    description: 'Project',
    content: {
        'application/json': { schema: z.object({ data: ProjectSchema }) },
    },
} as const;

registry.registerPath({
    method: 'get',
    path: '/api/projects',
    summary: 'List projects',
    operationId: 'listProjects',
    request: {
        query: z.object({
            active: z
                .enum(['true', 'false'])
                .optional()
                .openapi({ description: 'Filter by active status' }),
        }),
    },
    responses: {
        200: {
            description: 'List of projects',
            content: {
                'application/json': { schema: z.object({ data: z.array(ProjectSchema) }) },
                'text/plain': { schema: z.string() },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/api/projects',
    summary: 'Create a project',
    operationId: 'createProject',
    request: {
        body: {
            required: true,
            content: { 'application/json': { schema: CreateProjectSchema } },
        },
    },
    responses: {
        201: projectDataResponse,
        400: validationErrorResponse,
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/projects/{id}',
    summary: 'Get a project by ID',
    operationId: 'getProject',
    request: { params: idParams },
    responses: {
        200: projectDataResponse,
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'put',
    path: '/api/projects/{id}',
    summary: 'Update a project',
    operationId: 'updateProject',
    request: {
        params: idParams,
        body: {
            required: true,
            content: { 'application/json': { schema: UpdateProjectSchema } },
        },
    },
    responses: {
        200: projectDataResponse,
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'delete',
    path: '/api/projects/{id}',
    summary: 'Delete a project',
    operationId: 'deleteProject',
    request: { params: idParams },
    responses: {
        200: deleteSuccessResponse('Project deleted'),
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'post',
    path: '/api/projects/{id}/activate',
    summary: 'Activate a project',
    operationId: 'activateProject',
    request: { params: idParams },
    responses: {
        200: projectDataResponse,
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'post',
    path: '/api/projects/{id}/deactivate',
    summary: 'Deactivate a project',
    operationId: 'deactivateProject',
    request: { params: idParams },
    responses: {
        200: projectDataResponse,
        404: notFoundResponse,
    },
});
