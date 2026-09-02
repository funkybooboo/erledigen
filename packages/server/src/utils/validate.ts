/**
 * Validation utilities using Zod
 *
 * Provides consistent request body and query param parsing
 * that throws ValidationError on failure.
 */

import { ValidationError } from '@erledigen/shared';
import type { ZodSchema } from 'zod';

/**
 * Parse and validate a request body against a Zod schema.
 * Throws ValidationError with field-level details on failure.
 *
 * Call sites bridge the parsed result to the shared input types with a
 * SINGLE cast (`parseBody(Schema, raw) as CreateXInput`), never `as unknown
 * as`: zod infers `| undefined` unions on optional keys that
 * exactOptionalPropertyTypes rejects, so plain assignment cannot work, but
 * the single cast only compiles while the schema's shape still overlaps the
 * shared type -- renaming or retyping a field in either place fails the
 * build instead of silently diverging. inputParity.test.ts additionally
 * guards, per schema, that every public field of the shared type survives
 * parsing instead of being stripped as an unknown key.
 */
export function parseBody<T>(schema: ZodSchema<T>, raw: unknown): T {
    const result = schema.safeParse(raw);
    if (!result.success) {
        const fieldErrors = result.error.flatten().fieldErrors;
        const message = result.error.issues
            .map(i => `${i.path.join('.') || 'root'}: ${i.message}`)
            .join('; ');
        throw new ValidationError(message, { fields: fieldErrors });
    }
    return result.data;
}

/**
 * Parse and validate query parameters from a URL string against a Zod schema.
 * Throws ValidationError with field-level details on failure.
 */
export function parseQuery<T>(schema: ZodSchema<T>, url: string): T {
    const searchParams = Object.fromEntries(new URL(url, 'http://localhost').searchParams);
    return parseBody(schema, searchParams);
}
