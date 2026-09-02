/**
 * Input-schema parity tests.
 *
 * Each public API schema is paired with a shared input type, and the route
 * bridges them with a single overlap-checked cast (see parseBody). But a
 * cast still lets the two drift if the SCHEMA forgets a field the type
 * declares -- zod then silently strips that key from every request. That is
 * not hypothetical: `timeFormat`/`timezone` were stripped from every
 * preferences PATCH, and `state`/`reminder` from task requests, until this
 * suite existed.
 *
 * Every test parses a `Required<...>` sample (so a new type field must be
 * added to the sample, and accepted by the schema, or the test fails) and
 * requires each field to SURVIVE parsing.
 */

import { describe, expect, test } from 'bun:test';
import type {
    CreateProjectInput,
    CreateRecurringTaskInput,
    CreateSomeDayGroupInput,
    CreateTaskInput,
    UpdateProjectInput,
    UpdateRecurringTaskInput,
    UpdateSomeDayGroupInput,
    UpdateTaskInput,
    UpdateUserPreferencesInput,
} from '@erledigen/shared';
import { DEFAULT_TAG_KINDS, ValidationError } from '@erledigen/shared';
import { parseBody } from '../../utils/validate';
import { CreateProjectSchema, UpdateProjectSchema } from './project';
import { CreateRecurringTaskSchema, UpdateRecurringTaskSchema } from './recurringTask';
import { CreateSomeDayGroupSchema, UpdateSomeDayGroupSchema } from './someDayGroup';
import { CreateTaskSchema, UpdateTaskSchema } from './task';
import { UpdateUserPreferencesSchema } from './userPreferences';

type Schema = Parameters<typeof parseBody>[0];

/**
 * Parse `sample` and require every field -- except the listed
 * server-internal ones -- to survive. zod strips keys the schema does not
 * declare, which is exactly the drift these tests exist to catch.
 */
function parsePreserving(
    schema: Schema,
    sample: object,
    serverInternal: readonly string[] = [],
): Record<string, unknown> {
    const parsed = parseBody(schema, sample) as Record<string, unknown>;
    const stripped = Object.keys(sample).filter(
        key => !(key in parsed) && !serverInternal.includes(key),
    );
    expect(stripped).toEqual([]);
    return parsed;
}

describe('task schemas', () => {
    // recurringTaskId/instanceDate are intentionally NOT in the public
    // schemas: POST bodies must not be able to inject template links
    // (see CreateTaskInput's doc comment in shared/types/task.ts).
    const serverInternal = ['recurringTaskId', 'instanceDate'] as const;

    test('CreateTaskSchema keeps every public CreateTaskInput field', () => {
        const sample: Required<CreateTaskInput> = {
            text: 'Parity probe',
            date: '2026-09-02',
            notes: null,
            tags: ['p1'],
            parentId: null,
            someDayGroupId: null,
            rolloverEnabled: false,
            position: null,
            state: null,
            startTime: null,
            endTime: null,
            reminder: null,
            recurringTaskId: null,
            instanceDate: null,
        };
        const parsed = parsePreserving(CreateTaskSchema, sample, serverInternal);
        // The server-internal fields must stay stripped: the public API
        // must not let a client link a task to a template of its choosing.
        expect(parsed).not.toHaveProperty('recurringTaskId');
        expect(parsed).not.toHaveProperty('instanceDate');
    });

    test('CreateTaskSchema defaults an omitted date to null (Someday)', () => {
        // Before the default, the undefined slipped past the route cast:
        // SQLite bound it as null (Someday) while the in-memory adapter
        // stored a non-null undefined that findSomeday() missed.
        const parsed = parseBody(CreateTaskSchema, { text: 'No date given' });
        expect(parsed.date).toBeNull();
    });

    test('UpdateTaskSchema keeps every UpdateTaskInput field', () => {
        const sample: Required<UpdateTaskInput> = {
            text: 'Parity probe',
            notes: null,
            completed: false,
            date: null,
            tags: [],
            parentId: null,
            someDayGroupId: null,
            rolloverEnabled: false,
            position: null,
            state: 'scheduled',
            startTime: '09:30',
            endTime: '10:30',
            reminder: { time: '09:00', channels: ['push'] },
        };
        parsePreserving(UpdateTaskSchema, sample);
    });
});

describe('project schemas', () => {
    test('CreateProjectSchema keeps every CreateProjectInput field', () => {
        const sample: Required<CreateProjectInput> = {
            name: 'Parity probe',
            tag: 'project:parity-probe',
            description: null,
            startDate: '2026-09-02',
            dueDate: null,
        };
        parsePreserving(CreateProjectSchema, sample);
    });

    test('UpdateProjectSchema keeps every UpdateProjectInput field', () => {
        const sample: Required<UpdateProjectInput> = {
            name: 'Parity probe',
            tag: 'project:parity-probe',
            description: null,
            startDate: '2026-09-02',
            dueDate: null,
            isActive: true,
            completedAt: null,
        };
        parsePreserving(UpdateProjectSchema, sample);
    });
});

describe('someday-group schemas', () => {
    test('CreateSomeDayGroupSchema keeps every CreateSomeDayGroupInput field', () => {
        const sample: Required<CreateSomeDayGroupInput> = {
            name: 'Parity probe',
            tag: 'parity-probe',
            position: 0,
            description: null,
        };
        parsePreserving(CreateSomeDayGroupSchema, sample);
    });

    test('UpdateSomeDayGroupSchema keeps every UpdateSomeDayGroupInput field', () => {
        const sample: Required<UpdateSomeDayGroupInput> = {
            name: 'Parity probe',
            description: null,
            tag: 'parity-probe',
            position: 0,
        };
        parsePreserving(UpdateSomeDayGroupSchema, sample);
    });
});

describe('recurring-task schemas', () => {
    test('CreateRecurringTaskSchema keeps every CreateRecurringTaskInput field', () => {
        const sample: Required<CreateRecurringTaskInput> = {
            text: 'Parity probe',
            frequency: 'weekly',
            startDate: '2026-09-02',
            notes: null,
            tags: [],
            interval: 2,
            daysOfWeek: [1, 3, 5],
            dayOfMonth: null,
            endDate: null,
            rolloverEnabled: true,
            startTime: '09:30',
        };
        parsePreserving(CreateRecurringTaskSchema, sample);
    });

    test('UpdateRecurringTaskSchema keeps every UpdateRecurringTaskInput field', () => {
        const sample: Required<UpdateRecurringTaskInput> = {
            text: 'Parity probe',
            frequency: 'daily',
            startDate: '2026-09-02',
            notes: null,
            tags: [],
            interval: 1,
            daysOfWeek: null,
            dayOfMonth: 15,
            endDate: null,
            rolloverEnabled: true,
            startTime: null,
        };
        parsePreserving(UpdateRecurringTaskSchema, sample);
    });
});

describe('user preferences schema', () => {
    test('UpdateUserPreferencesSchema keeps every UpdateUserPreferencesInput field', () => {
        const sample: Required<UpdateUserPreferencesInput> = {
            theme: 'system',
            locale: 'en',
            someDayPanelWidth: 280,
            someDayPanelCollapsed: false,
            someDayPanelLastOpenWidth: 280,
            rolloverEnabled: true,
            showEmptyDays: true,
            deleteConfirmation: 'instant',
            activeFilters: { tags: ['p1'], showCompleted: true },
            tagKinds: [...DEFAULT_TAG_KINDS],
            tagKindMap: { p1: 'priority' },
            timeFormat: '24h',
            timezone: 'America/Denver',
        };
        parsePreserving(UpdateUserPreferencesSchema, sample);
    });

    test('accepts a null timezone (follow the device zone)', () => {
        const parsed = parseBody(UpdateUserPreferencesSchema, { timezone: null });
        expect(parsed.timezone).toBeNull();
    });

    test('rejects an unknown IANA timezone', () => {
        expect(() =>
            parseBody(UpdateUserPreferencesSchema, { timezone: 'Mars/Olympus_Mons' }),
        ).toThrow(ValidationError);
    });
});
