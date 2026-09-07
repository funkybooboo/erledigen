/**
 * OpenAPI path registrations: user preferences.
 *
 * Importing this module registers these paths with the registry
 * (side-effect module; openapi/spec.ts imports it for that).
 */

import { z } from 'zod';
import { registry } from '../registry';
import { UpdateUserPreferencesSchema, UserPreferencesSchema } from '../schemas/userPreferences';
import { validationErrorResponse } from './common';

// -- User Preferences -----------------------------------------------------------

const prefsDataResponse = {
    description: 'User preferences',
    content: {
        'application/json': { schema: z.object({ data: UserPreferencesSchema }) },
    },
} as const;

registry.registerPath({
    method: 'get',
    path: '/api/preferences',
    summary: 'Get user preferences',
    operationId: 'getUserPreferences',
    responses: {
        200: {
            ...prefsDataResponse,
            content: {
                'application/json': { schema: z.object({ data: UserPreferencesSchema }) },
                'text/plain': { schema: z.string() },
            },
        },
    },
});

registry.registerPath({
    method: 'patch',
    path: '/api/preferences',
    summary: 'Update user preferences',
    operationId: 'updateUserPreferences',
    request: {
        body: {
            required: true,
            content: { 'application/json': { schema: UpdateUserPreferencesSchema } },
        },
    },
    responses: {
        200: prefsDataResponse,
        400: validationErrorResponse,
    },
});
