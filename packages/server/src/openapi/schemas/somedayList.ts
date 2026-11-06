/**
 * SomedayList entity schemas (USE-16, ADR-011).
 */

import { z } from 'zod';
import { registry } from '../registry';

export const SomedayListSchema = registry.register(
    'SomedayList',
    z
        .object({
            id: z.string(),
            tabId: z.string(),
            name: z.string(),
            position: z.number().int(),
            createdAt: z.string(),
        })
        .openapi('SomedayList'),
);

export const CreateSomedayListSchema = registry.register(
    'CreateSomedayListInput',
    z
        .object({
            tabId: z.string().min(1),
            name: z.string().min(1).max(100),
            position: z.number().int().min(0),
        })
        .openapi('CreateSomedayListInput'),
);

export const UpdateSomedayListSchema = registry.register(
    'UpdateSomedayListInput',
    z
        .object({
            tabId: z.string().min(1).optional(),
            name: z.string().min(1).max(100).optional(),
            position: z.number().int().min(0).optional(),
        })
        .openapi('UpdateSomedayListInput'),
);
