/**
 * OpenAPI path registrations: recurring tasks (templates, generation, stats).
 *
 * Importing this module registers these paths with the registry
 * (side-effect module; openapi/spec.ts imports it for that).
 */

import { z } from 'zod';
import { registry } from '../registry';
import {
    AdoptTaskAsRecurringSchema,
    CreateRecurringTaskSchema,
    GenerateInstancesSchema,
    RecurringTaskSchema,
    RecurringTaskStatsWithHistorySchema,
    UpdateRecurringTaskSchema,
} from '../schemas/recurringTask';
import { TaskSchema } from '../schemas/task';
import {
    deleteSuccessResponse,
    idParams,
    notFoundResponse,
    validationErrorResponse,
} from './common';

// -- Recurring Tasks ------------------------------------------------------------

const recurringTaskDataResponse = {
    description: 'Recurring task',
    content: {
        'application/json': { schema: z.object({ data: RecurringTaskSchema }) },
    },
} as const;

registry.registerPath({
    method: 'get',
    path: '/api/recurring-tasks',
    summary: 'List recurring task templates',
    operationId: 'listRecurringTasks',
    responses: {
        200: {
            description: 'List of recurring tasks',
            content: {
                'application/json': {
                    schema: z.object({ data: z.array(RecurringTaskSchema) }),
                },
                'text/plain': { schema: z.string() },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/api/recurring-tasks',
    summary: 'Create a recurring task template',
    operationId: 'createRecurringTask',
    request: {
        body: {
            required: true,
            content: { 'application/json': { schema: CreateRecurringTaskSchema } },
        },
    },
    responses: {
        201: recurringTaskDataResponse,
        400: validationErrorResponse,
    },
});

registry.registerPath({
    method: 'post',
    path: '/api/recurring-tasks/adopt',
    summary:
        'Adopt an existing task as the first instance of a new template (the Make recurring toggle)',
    operationId: 'adoptTaskAsRecurring',
    description:
        'Creates a template from the task (text/notes/tags/rollover), stamps the task itself as the template first instance (never deleted or duplicated), and generates the remaining occurrences from the schedule start (the task date, or today for a Someday task). Rejects 409 when the task already belongs to a template.',
    request: {
        body: {
            required: true,
            content: { 'application/json': { schema: AdoptTaskAsRecurringSchema } },
        },
    },
    responses: {
        201: {
            description: 'The new template, the stamped task, and the generated instances',
            content: {
                'application/json': {
                    schema: z.object({
                        data: z.object({
                            recurringTask: RecurringTaskSchema,
                            task: TaskSchema,
                            tasks: z.array(TaskSchema),
                        }),
                    }),
                },
            },
        },
        400: validationErrorResponse,
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/recurring-tasks/{id}',
    summary: 'Get a recurring task by ID',
    operationId: 'getRecurringTask',
    request: { params: idParams },
    responses: {
        200: recurringTaskDataResponse,
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'put',
    path: '/api/recurring-tasks/{id}',
    summary: 'Update a recurring task template',
    operationId: 'updateRecurringTask',
    request: {
        params: idParams,
        body: {
            required: true,
            content: { 'application/json': { schema: UpdateRecurringTaskSchema } },
        },
    },
    responses: {
        200: recurringTaskDataResponse,
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'delete',
    path: '/api/recurring-tasks/{id}',
    summary: 'Delete a recurring task template',
    operationId: 'deleteRecurringTask',
    request: { params: idParams },
    responses: {
        200: deleteSuccessResponse('Recurring task deleted'),
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'post',
    path: '/api/recurring-tasks/{id}/generate',
    summary: 'Generate task instances for a date range',
    operationId: 'generateRecurringTaskInstances',
    request: {
        params: idParams,
        body: {
            required: true,
            content: { 'application/json': { schema: GenerateInstancesSchema } },
        },
    },
    responses: {
        200: {
            description: 'Generated task instances',
            content: {
                'application/json': { schema: z.object({ data: z.array(TaskSchema) }) },
            },
        },
        400: validationErrorResponse,
        404: notFoundResponse,
    },
});

registry.registerPath({
    method: 'post',
    path: '/api/recurring-tasks/generate-all',
    summary: 'Generate missing instances for every template in a date range',
    operationId: 'generateAllRecurringTaskInstances',
    request: {
        body: {
            required: true,
            content: { 'application/json': { schema: GenerateInstancesSchema } },
        },
    },
    responses: {
        200: {
            description:
                'Templates that created new instances (idempotent; existing instances are untouched)',
            content: {
                'application/json': {
                    schema: z.object({
                        data: z.array(
                            z.object({
                                recurringTaskId: z.string(),
                                tasks: z.array(TaskSchema),
                            }),
                        ),
                    }),
                },
            },
        },
        400: validationErrorResponse,
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/recurring-tasks/{id}/stats',
    summary:
        'Streak stats for one template (recomputed from its instances on read), plus the completedDates heatmap history',
    operationId: 'getRecurringTaskStats',
    request: { params: idParams },
    responses: {
        200: {
            description: 'Streak stats',
            content: {
                'application/json': {
                    schema: z.object({ data: RecurringTaskStatsWithHistorySchema }),
                },
            },
        },
        404: notFoundResponse,
    },
});
