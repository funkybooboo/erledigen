/**
 * RecurringTask entity schemas.
 */

import { z } from 'zod';
import { registry } from '../registry';
import { IsoDate } from './common';

/** 24h clock time, "HH:MM". */
export const TimeHHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** Weekday numbers, 0 = Sunday (0-6). */
const DaysOfWeek = z.array(z.number().int().min(0).max(6));

export const RecurringTaskSchema = registry.register(
    'RecurringTask',
    z
        .object({
            id: z.string(),
            text: z.string().min(1).max(500),
            notes: z.string().nullable(),
            tags: z.array(z.string()),
            frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
            interval: z.number().int().min(1).openapi({ description: 'e.g. 2 = every 2 weeks' }),
            daysOfWeek: DaysOfWeek.nullable().openapi({
                description:
                    'Weekdays (0-6, 0 = Sunday) the schedule lands on; null = any day. [1,2,3,4,5] = weekdays, [0,6] = weekends',
            }),
            dayOfMonth: z.number().int().min(1).max(31).nullable().openapi({
                description: '1-31 for monthly recurrence',
            }),
            startDate: IsoDate,
            endDate: IsoDate.nullable(),
            rolloverEnabled: z.boolean(),
            startTime: TimeHHMM.nullable().openapi({
                description: 'Default start time (24h HH:MM) stamped onto generated instances',
            }),
            createdAt: z.string(),
            updatedAt: z.string(),
        })
        .openapi('RecurringTask'),
);

export const CreateRecurringTaskSchema = registry.register(
    'CreateRecurringTaskInput',
    z
        .object({
            text: z.string().min(1).max(500),
            frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
            startDate: IsoDate,
            notes: z.string().nullable().optional(),
            tags: z.array(z.string()).optional(),
            interval: z.number().int().min(1).optional(),
            daysOfWeek: DaysOfWeek.nullable().optional(),
            dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
            endDate: IsoDate.nullable().optional(),
            rolloverEnabled: z.boolean().optional(),
            startTime: TimeHHMM.nullable().optional(),
        })
        .openapi('CreateRecurringTaskInput'),
);

export const UpdateRecurringTaskSchema = registry.register(
    'UpdateRecurringTaskInput',
    CreateRecurringTaskSchema.partial().openapi('UpdateRecurringTaskInput'),
);

export const GenerateInstancesSchema = registry.register(
    'GenerateInstancesInput',
    z
        .object({
            startDate: IsoDate.openapi({ description: 'ISO 8601 date (YYYY-MM-DD)' }),
            endDate: IsoDate.openapi({ description: 'ISO 8601 date (YYYY-MM-DD)' }),
        })
        .openapi('GenerateInstancesInput'),
);

export const RecurringTaskStatsSchema = registry.register(
    'RecurringTaskStats',
    z
        .object({
            recurringTaskId: z.string(),
            currentStreak: z.number().int().min(0),
            longestStreak: z.number().int().min(0),
            totalCompletions: z.number().int().min(0),
            lastCompletedDate: IsoDate.nullable(),
        })
        .openapi('RecurringTaskStats'),
);
