/**
 * SomedayTab entity schemas (USE-16, ADR-011).
 */

import { z } from 'zod';
import { registry } from '../registry';

export const SomedayTabSchema = registry.register(
    'SomedayTab',
    z
        .object({
            id: z.string(),
            name: z.string(),
            position: z.number().int(),
            projectTag: z.string().nullable(),
            createdAt: z.string(),
        })
        .openapi('SomedayTab'),
);

export const CreateSomedayTabSchema = registry.register(
    'CreateSomedayTabInput',
    z
        .object({
            name: z.string().min(1).max(100),
            position: z.number().int().min(0),
            projectTag: z.string().min(1).max(50).nullable().optional(),
        })
        .openapi('CreateSomedayTabInput'),
);

export const UpdateSomedayTabSchema = registry.register(
    'UpdateSomedayTabInput',
    z
        .object({
            name: z.string().min(1).max(100).optional(),
            position: z.number().int().min(0).optional(),
            projectTag: z.string().min(1).max(50).nullable().optional(),
        })
        .openapi('UpdateSomedayTabInput'),
);
