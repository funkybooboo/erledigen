/**
 * OpenAPI path registrations: tags.
 *
 * Importing this module registers these paths with the registry
 * (side-effect module; openapi/spec.ts imports it for that).
 */

import { z } from 'zod';
import { registry } from '../registry';
import { MergeTagsSchema, RenameTagSchema } from '../schemas/tag';
import { validationErrorResponse } from './common';

// -- Tags -----------------------------------------------------------------------

const updatedCountResponse = {
    description: 'Number of tasks updated',
    content: {
        'application/json': {
            schema: z.object({ data: z.object({ updated: z.number().int() }) }),
        },
    },
} as const;

registry.registerPath({
    method: 'get',
    path: '/api/tags',
    summary: 'List all tags (derived from task data)',
    operationId: 'listTags',
    responses: {
        200: {
            description: 'Sorted list of unique tags',
            content: {
                'application/json': { schema: z.object({ data: z.array(z.string()) }) },
                'text/plain': { schema: z.string() },
            },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/api/tags/info',
    summary: 'List tags with their task counts',
    operationId: 'listTagInfo',
    responses: {
        200: {
            description: 'Tags with task counts, sorted by name',
            content: {
                'application/json': {
                    schema: z.object({
                        data: z.array(z.object({ name: z.string(), count: z.number().int() })),
                    }),
                },
                'text/plain': { schema: z.string() },
            },
        },
    },
});

registry.registerPath({
    method: 'post',
    path: '/api/tags/rename',
    summary: 'Rename a tag across all tasks',
    operationId: 'renameTag',
    request: {
        body: { required: true, content: { 'application/json': { schema: RenameTagSchema } } },
    },
    responses: {
        200: updatedCountResponse,
        400: validationErrorResponse,
    },
});

registry.registerPath({
    method: 'post',
    path: '/api/tags/merge',
    summary: 'Merge multiple tags into one',
    operationId: 'mergeTags',
    request: {
        body: { required: true, content: { 'application/json': { schema: MergeTagsSchema } } },
    },
    responses: {
        200: updatedCountResponse,
        400: validationErrorResponse,
    },
});
