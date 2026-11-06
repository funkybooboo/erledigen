/**
 * SomedayListRepository contract tests (see ADR-003)
 *
 * The same suite runs against every SomedayListRepository implementation
 * (InMemorySomedayListRepository, SqliteSomedayListRepository) to
 * guarantee behavioral parity. Both implementations start from the
 * migration-013 seed: the default list under the default tab.
 */

import { describe, expect, test } from 'bun:test';
import { DEFAULT_SOMEDAY_LIST_ID, DEFAULT_SOMEDAY_TAB_ID } from '@erledigen/shared';
import type { SomedayListRepository } from '../SomedayListRepository';

export function runSomedayListRepositoryContractTests(makeRepo: () => SomedayListRepository): void {
    describe('seeded default list', () => {
        test('starts with the default list, first by position', async () => {
            const repo = makeRepo();
            const lists = await repo.findAll();
            expect(lists.length).toBe(1);
            expect(lists[0]?.id).toBe(DEFAULT_SOMEDAY_LIST_ID);
            expect(lists[0]?.tabId).toBe(DEFAULT_SOMEDAY_TAB_ID);
            expect(lists[0]?.name).toBe('Someday');
            expect(lists[0]?.position).toBe(0);
        });

        test('finds the default list by id', async () => {
            const repo = makeRepo();
            const list = await repo.findById(DEFAULT_SOMEDAY_LIST_ID);
            expect(list?.id).toBe(DEFAULT_SOMEDAY_LIST_ID);
        });
    });

    describe('create', () => {
        test('creates a list with generated id and createdAt', async () => {
            const repo = makeRepo();
            const list = await repo.create({ tabId: 'default', name: 'Work', position: 1 });
            expect(list.id).toBeDefined();
            expect(list.id).not.toBe(DEFAULT_SOMEDAY_LIST_ID);
            expect(list.createdAt).toBeDefined();
            expect(list.name).toBe('Work');
            expect(list.tabId).toBe('default');
            expect(list.position).toBe(1);
        });

        test('assigns sequential ids', async () => {
            const repo = makeRepo();
            const a = await repo.create({ tabId: 'default', name: 'A', position: 1 });
            const b = await repo.create({ tabId: 'default', name: 'B', position: 2 });
            expect(a.id).not.toBe(b.id);
        });
    });

    describe('findAll', () => {
        test('returns lists sorted by position', async () => {
            const repo = makeRepo();
            await repo.create({ tabId: 'default', name: 'C', position: 3 });
            await repo.create({ tabId: 'default', name: 'A', position: 1 });
            await repo.create({ tabId: 'default', name: 'B', position: 2 });
            const lists = await repo.findAll();
            expect(lists.map(l => l.name)).toEqual(['Someday', 'A', 'B', 'C']);
        });
    });

    describe('findById', () => {
        test('returns null for unknown id', async () => {
            const repo = makeRepo();
            expect(await repo.findById('nope')).toBeNull();
        });

        test('returns the list when found', async () => {
            const repo = makeRepo();
            const created = await repo.create({ tabId: 'default', name: 'Work', position: 1 });
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
            const created = await repo.create({ tabId: 'default', name: 'Work', position: 1 });
            const updated = await repo.update(created.id, { name: 'Updated' });
            expect(updated?.name).toBe('Updated');
            expect(updated?.tabId).toBe('default');
            expect(updated?.position).toBe(1);
        });
    });

    describe('delete', () => {
        test('returns false for unknown id', async () => {
            const repo = makeRepo();
            expect(await repo.delete('nope')).toBe(false);
        });

        test('returns true and removes the list', async () => {
            const repo = makeRepo();
            const list = await repo.create({ tabId: 'default', name: 'Work', position: 1 });
            expect(await repo.delete(list.id)).toBe(true);
            expect(await repo.findById(list.id)).toBeNull();
        });
    });

    describe('replaceAll (restore write path)', () => {
        test('replaces every list verbatim', async () => {
            const repo = makeRepo();
            await repo.create({ tabId: 'default', name: 'Old list', position: 1 });
            await repo.replaceAll([
                {
                    id: 'l7',
                    tabId: 'default',
                    name: 'From backup',
                    position: 3,
                    createdAt: '2026-01-01T00:00:00.000Z',
                },
            ]);
            const all = await repo.findAll();
            expect(all.length).toBe(1);
            expect(all[0]?.id).toBe('l7');
            expect(all[0]?.tabId).toBe('default');
            expect(all[0]?.position).toBe(3);
        });
    });
}
