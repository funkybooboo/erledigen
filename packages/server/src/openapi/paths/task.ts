/**
 * OpenAPI path registrations: tasks.
 *
 * Importing this module registers these paths with the registry
 * (side-effect module; openapi/spec.ts imports it for that).
 */

import { z } from 'zod';
import { registry } from '../registry';
import { CreateTaskSchema, TaskSchema, UpdateTaskSchema } from '../schemas/task';
import {
    deleteSuccessResponse,
    idParams,
    notFoundResponse,
    rateLimitResponse,
    validationErrorResponse,
} from './common';

// -- Tasks ----------------------------------------------------------------------

const taskDataResponse = {
    description: 'Task',
    content: {
        'application/json': { schema: z.object({ data: TaskSchema }) },
    },
} as const;

registry.registerPath({
    method: 'get',
    path: '/api/tasks',
    summary: 'List tasks',
    operationId: 'listTasks',
    request: {
        query: z.object({
            date: z.string().optional().openapi({ description: 'Filter by date (YYYY-MM-DD)' }),
            tag: z.string().optional().openapi({ description: 'Filter by tag' }),
            completed: z
                .enum(['true', 'false'])
                .optional()
                .openapi({ description: 'Filter by completion status' }),
            someDayGroupId: z
                .string()
                .optional()
                .openapi({ description: 'Filter by Someday group' }),
            someday: z
                .enum(['true'])
                .optional()
                .openapi({ description: 'Return only Someday tasks (date is null)' }),
        }),
    },
    responses: {
        200: {
            description: 'List of tasks (JSON or plain text depending on Accept header)',
            content: {
                'application/json': { schema: z.object({ data: z.array(TaskSchema) }) },
                'text/plain': { schema: z.string() },
            },
        },
        429: rateLimitResponse,
    },
});

registry.registerPath({
    method: 'post',
    path: '/api/tasks',
    summary: 'Create a task',
    operationId: 'createTask',
    request: {
        body: { required: true, content: { 'application/json': { schema: CreateTaskSchema } } },
    },
    responses: {
        201: taskDataResponse,
        400: validationErrorResponse,
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/tasks/{id}',
    summary: 'Get a task by ID',
    operationId: 'getTask',
    request: { params: idParams },
    responses: {
        200: taskDataResponse,
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'put',
    path: '/api/tasks/{id}',
    summary: 'Update a task',
    operationId: 'updateTask',
    request: {
        params: idParams,
        body: { required: true, content: { 'application/json': { schema: UpdateTaskSchema } } },
    },
    responses: {
        200: taskDataResponse,
        400: validationErrorResponse,
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'delete',
    path: '/api/tasks/{id}',
    summary: 'Delete a task',
    operationId: 'deleteTask',
    request: { params: idParams },
    responses: {
        200: deleteSuccessResponse('Task deleted'),
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/tasks/trash',
    summary: 'List soft-deleted tasks (the trash)',
    operationId: 'listTrash',
    responses: {
        200: {
            description: 'Soft-deleted tasks, newest first (retention is enforced only by purge)',
            content: {
                'application/json': { schema: z.object({ data: z.array(TaskSchema) }) },
            },
        },
    },
});

registry.registerPath({
    method: 'delete',
    path: '/api/tasks/purge',
    summary: 'Permanently delete tasks that have been in the trash past the retention window',
    operationId: 'purgeTrash',
    responses: {
        200: {
            description: 'Number of tasks permanently deleted',
            content: {
                'application/json': {
                    schema: z.object({ data: z.object({ purged: z.number().int() }) }),
                },
            },
        },
        429: rateLimitResponse,
    },
});

registry.registerPath({
    method: 'post',
    path: '/api/tasks/{id}/restore',
    summary: 'Restore a soft-deleted task',
    operationId: 'restoreTask',
    request: { params: idParams },
    responses: {
        200: taskDataResponse,
        404: notFoundResponse,
    },
});
