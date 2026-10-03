/**
 * HolidayRepository contract tests (see ADR-003).
 *
 * The same suite runs against every HolidayRepository implementation
 * (InMemoryHolidayRepository, SqliteHolidayRepository) to guarantee
 * behavioral parity.
 */

import { describe, expect, test } from 'bun:test';
import type { HolidayRepository } from '../HolidayRepository';

export function runHolidayRepositoryContractTests(makeRepo: () => HolidayRepository): void {
    describe('create', () => {
        test('creates a holiday with generated id and createdAt', async () => {
            const repo = makeRepo();
            const holiday = await repo.create({ name: 'Independence Day', date: '2026-07-04' });
            expect(holiday.id).toBeDefined();
            expect(holiday.createdAt).toBeDefined();
            expect(holiday.name).toBe('Independence Day');
            expect(holiday.date).toBe('2026-07-04');
        });

        test('assigns sequential ids', async () => {
            const repo = makeRepo();
            const a = await repo.create({ name: 'A', date: '2026-01-01' });
            const b = await repo.create({ name: 'B', date: '2026-01-02' });
            expect(a.id).not.toBe(b.id);
        });
    });

    describe('findAll', () => {
        test('returns empty array when no holidays exist', async () => {
            const repo = makeRepo();
            expect(await repo.findAll()).toEqual([]);
        });

        test('returns holidays in date order, name as tiebreak', async () => {
            const repo = makeRepo();
            await repo.create({ name: 'Later', date: '2026-12-25' });
            await repo.create({ name: 'Zed', date: '2026-01-01' });
            await repo.create({ name: 'Alpha', date: '2026-01-01' });
            const holidays = await repo.findAll();
            expect(holidays.map(h => `${h.date}:${h.name}`)).toEqual([
                '2026-01-01:Alpha',
                '2026-01-01:Zed',
                '2026-12-25:Later',
            ]);
        });
    });

    describe('findByDate', () => {
        test('returns holidays for the date only', async () => {
            const repo = makeRepo();
            const holiday = await repo.create({ name: 'New Year', date: '2026-01-01' });
            await repo.create({ name: 'Unrelated', date: '2026-03-08' });
            const found = await repo.findByDate('2026-01-01');
            expect(found.map(h => h.id)).toEqual([holiday.id]);
        });

        test('returns empty array for a date with no holidays', async () => {
            const repo = makeRepo();
            await repo.create({ name: 'New Year', date: '2026-01-01' });
            expect(await repo.findByDate('2026-06-01')).toEqual([]);
        });
    });

    describe('findById', () => {
        test('returns null for unknown id', async () => {
            const repo = makeRepo();
            expect(await repo.findById('nope')).toBeNull();
        });

        test('returns the holiday when found', async () => {
            const repo = makeRepo();
            const created = await repo.create({ name: 'New Year', date: '2026-01-01' });
            const found = await repo.findById(created.id);
            expect(found).toEqual(created);
        });
    });

    describe('update', () => {
        test('returns null for unknown id', async () => {
            const repo = makeRepo();
            expect(await repo.update('nope', { name: 'New' })).toBeNull();
        });

        test('updates only provided fields', async () => {
            const repo = makeRepo();
            const created = await repo.create({ name: 'New Year', date: '2026-01-01' });
            const updated = await repo.update(created.id, { date: '2027-01-01' });
            expect(updated?.name).toBe('New Year');
            expect(updated?.date).toBe('2027-01-01');
        });
    });

    describe('replaceAll (restore write path)', () => {
        test('replaces every holiday verbatim', async () => {
            const repo = makeRepo();
            await repo.create({ name: 'Old holiday', date: '2026-01-01' });
            await repo.replaceAll([
                {
                    id: 'h7',
                    name: 'From backup',
                    date: '2026-12-25',
                    createdAt: '2026-01-01T00:00:00.000Z',
                },
            ]);
            const all = await repo.findAll();
            expect(all.length).toBe(1);
            expect(all[0]?.id).toBe('h7');
            expect(all[0]?.name).toBe('From backup');
            expect(all[0]?.createdAt).toBe('2026-01-01T00:00:00.000Z');
        });

        test('continues assigning ids above the restored max', async () => {
            const repo = makeRepo();
            await repo.replaceAll([
                {
                    id: '9',
                    name: 'Restored',
                    date: '2026-12-25',
                    createdAt: '2026-01-01T00:00:00.000Z',
                },
            ]);
            const created = await repo.create({ name: 'Next', date: '2027-01-01' });
            expect(Number.parseInt(created.id, 10)).toBeGreaterThan(9);
        });
    });

    describe('delete', () => {
        test('returns false for unknown id', async () => {
            const repo = makeRepo();
            expect(await repo.delete('nope')).toBe(false);
        });

        test('returns true and removes the holiday', async () => {
            const repo = makeRepo();
            const holiday = await repo.create({ name: 'New Year', date: '2026-01-01' });
            expect(await repo.delete(holiday.id)).toBe(true);
            expect(await repo.findById(holiday.id)).toBeNull();
        });
    });
}
