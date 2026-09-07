/**
 * JsonExportAdapter tests -- the canonical, lossless backup format
 * (see ADR-008).
 */

import { describe, expect, test } from 'bun:test';
import { makeSnapshot, makeTask } from './exportFixtures';
import { JsonExportAdapter } from './JsonExportAdapter';

describe('JsonExportAdapter', () => {
    const adapter = new JsonExportAdapter();

    test('declares the json extension and media type', () => {
        expect(adapter.extension).toBe('json');
        expect(adapter.contentType).toBe('application/json');
    });

    test('serializes the snapshot losslessly (round-trips through JSON.parse)', () => {
        const snapshot = makeSnapshot({
            tasks: [makeTask({ id: 't1', text: 'Buy milk', tags: ['p1'] })],
        });

        const body = adapter.export(snapshot);

        expect(JSON.parse(body)).toEqual(snapshot);
    });

    test('includes soft-deleted (trash) tasks -- the backup must not lose the trash', () => {
        const snapshot = makeSnapshot({
            tasks: [makeTask({ id: 't1', text: 'Gone', deletedAt: '2026-01-12T08:00:00.000Z' })],
        });

        const parsed = JSON.parse(adapter.export(snapshot)) as { tasks: { id: string }[] };

        expect(parsed.tasks.map(t => t.id)).toEqual(['t1']);
    });

    test('is pretty-printed so backups stay diff-friendly', () => {
        const body = adapter.export(makeSnapshot());

        expect(body).toContain('\n  "format"');
    });
});
