/**
 * DayNoteRepository contract tests (see ADR-003).
 *
 * The same suite runs against every DayNoteRepository implementation
 * (InMemoryDayNoteRepository, SqliteDayNoteRepository) to guarantee
 * behavioral parity.
 */

import { describe, expect, test } from 'bun:test';
import type { DayNote } from '@erledigen/shared';
import type { DayNoteRepository } from '../DayNoteRepository';

const RESTORED_NOTE: DayNote = {
    id: '9',
    date: '2026-12-25',
    notes: 'restored verbatim',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
};

export function runDayNoteRepositoryContractTests(makeRepo: () => DayNoteRepository): void {
    describe('upsert', () => {
        test('creates the first note for a date with id and timestamps', async () => {
            const repo = makeRepo();
            const result = await repo.upsert('2026-10-04', { notes: 'margin jot' });
            expect(result.created).toBe(true);
            expect(result.dayNote.id).toBeDefined();
            expect(result.dayNote.date).toBe('2026-10-04');
            expect(result.dayNote.notes).toBe('margin jot');
            expect(result.dayNote.createdAt).toBe(result.dayNote.updatedAt);
        });

        test('replaces an existing note for the same date (created: false, id kept)', async () => {
            const repo = makeRepo();
            const first = await repo.upsert('2026-10-04', { notes: 'one' });
            const second = await repo.upsert('2026-10-04', { notes: 'two' });
            expect(second.created).toBe(false);
            expect(second.dayNote.id).toBe(first.dayNote.id);
            expect(second.dayNote.notes).toBe('two');
            expect(second.dayNote.createdAt).toBe(first.dayNote.createdAt);
        });

        test('never lets two notes exist for one date', async () => {
            const repo = makeRepo();
            await repo.upsert('2026-10-04', { notes: 'one' });
            await repo.upsert('2026-10-04', { notes: 'two' });
            expect((await repo.findAll()).length).toBe(1);
        });

        test('assigns sequential ids', async () => {
            const repo = makeRepo();
            const a = await repo.upsert('2026-01-01', { notes: 'a' });
            const b = await repo.upsert('2026-01-02', { notes: 'b' });
            expect(a.dayNote.id).not.toBe(b.dayNote.id);
        });
    });

    describe('findByDate', () => {
        test('returns null when the day has no note', async () => {
            const repo = makeRepo();
            expect(await repo.findByDate('2026-06-01')).toBeNull();
        });

        test('returns the day note when it exists', async () => {
            const repo = makeRepo();
            const { dayNote } = await repo.upsert('2026-01-01', { notes: 'hello' });
            expect(await repo.findByDate('2026-01-01')).toEqual(dayNote);
        });
    });

    describe('findAll', () => {
        test('returns empty array when no day notes exist', async () => {
            const repo = makeRepo();
            expect(await repo.findAll()).toEqual([]);
        });

        test('returns day notes in date order', async () => {
            const repo = makeRepo();
            await repo.upsert('2026-12-25', { notes: 'xmas' });
            await repo.upsert('2026-01-01', { notes: 'ny' });
            const all = await repo.findAll();
            expect(all.map(n => n.date)).toEqual(['2026-01-01', '2026-12-25']);
        });
    });

    describe('replaceAll (restore write path)', () => {
        test('replaces every day note verbatim', async () => {
            const repo = makeRepo();
            await repo.upsert('2026-01-01', { notes: 'old note' });
            await repo.replaceAll([RESTORED_NOTE]);
            const all = await repo.findAll();
            expect(all.length).toBe(1);
            expect(all[0]).toEqual(RESTORED_NOTE);
        });

        test('continues assigning ids above the restored max', async () => {
            const repo = makeRepo();
            await repo.replaceAll([RESTORED_NOTE]);
            const created = await repo.upsert('2027-01-01', { notes: 'next' });
            expect(Number.parseInt(created.dayNote.id, 10)).toBeGreaterThan(9);
        });
    });

    describe('delete', () => {
        test('returns false for a date with no note', async () => {
            const repo = makeRepo();
            expect(await repo.delete('2026-06-01')).toBe(false);
        });

        test('returns true and removes the note', async () => {
            const repo = makeRepo();
            await repo.upsert('2026-01-01', { notes: 'gone soon' });
            expect(await repo.delete('2026-01-01')).toBe(true);
            expect(await repo.findByDate('2026-01-01')).toBeNull();
        });

        test('allows upserting again after a delete', async () => {
            const repo = makeRepo();
            await repo.upsert('2026-01-01', { notes: 'first' });
            await repo.delete('2026-01-01');
            const again = await repo.upsert('2026-01-01', { notes: 'second' });
            expect(again.created).toBe(true);
        });
    });
}
