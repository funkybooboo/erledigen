/**
 * MarkdownExportAdapter tests -- the day-grouped plain-text task view.
 */

import { describe, expect, test } from 'bun:test';
import { makeSnapshot, makeTask } from './exportFixtures';
import { MarkdownExportAdapter } from './MarkdownExportAdapter';

describe('MarkdownExportAdapter', () => {
    const adapter = new MarkdownExportAdapter();

    test('declares the md extension and text/markdown media type', () => {
        expect(adapter.extension).toBe('md');
        expect(adapter.contentType).toBe('text/markdown');
    });

    test('groups tasks under date headings with checkbox syntax and tags', () => {
        const snapshot = makeSnapshot({
            tasks: [
                makeTask({
                    id: 't1',
                    text: 'Buy milk',
                    date: '2026-01-15',
                    tags: ['p1', 'errands'],
                }),
                makeTask({ id: 't2', text: 'Ship release', date: '2026-01-15', completed: true }),
                makeTask({ id: 't3', text: 'Write report', date: '2026-01-14' }),
            ],
        });

        const body = adapter.export(snapshot);

        const lines = body.split('\n');
        expect(lines).toContain('## 2026-01-14');
        expect(lines).toContain('## 2026-01-15');
        expect(lines).toContain('- [ ] Write report');
        expect(lines).toContain('- [ ] Buy milk #p1 #errands');
        expect(lines).toContain('- [x] Ship release');
        // Date sections ascend, earliest first.
        expect(body.indexOf('## 2026-01-14')).toBeLessThan(body.indexOf('## 2026-01-15'));
    });

    test('lists Someday tasks under a final section after all date sections', () => {
        const snapshot = makeSnapshot({
            tasks: [
                makeTask({ id: 't1', text: 'Learn piano', date: null }),
                makeTask({ id: 't2', text: 'Dated', date: '2026-01-15' }),
            ],
        });

        const body = adapter.export(snapshot);

        expect(body).toContain('## Someday');
        expect(body).toContain('- [ ] Learn piano');
        expect(body.indexOf('## 2026-01-15')).toBeLessThan(body.indexOf('## Someday'));
    });

    test('excludes soft-deleted tasks', () => {
        const snapshot = makeSnapshot({
            tasks: [makeTask({ id: 't1', text: 'Trashed', deletedAt: '2026-01-12T08:00:00.000Z' })],
        });

        expect(adapter.export(snapshot)).toBe('');
    });

    test('renders an empty snapshot as an empty document', () => {
        expect(adapter.export(makeSnapshot())).toBe('');
    });
});
