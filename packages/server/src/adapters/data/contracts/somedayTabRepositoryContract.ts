/**
 * SomedayTabRepository contract tests (see ADR-003)
 *
 * The same suite runs against every SomedayTabRepository implementation
 * (InMemorySomedayTabRepository, SqliteSomedayTabRepository) to guarantee
 * behavioral parity. Both implementations start from the migration-013
 * seed: the default tab (fixed id, named "Someday").
 */

import { describe, expect, test } from 'bun:test';
import { DEFAULT_SOMEDAY_TAB_ID } from '@erledigen/shared';
import type { SomedayTabRepository } from '../SomedayTabRepository';

export function runSomedayTabRepositoryContractTests(makeRepo: () => SomedayTabRepository): void {
    describe('seeded default tab', () => {
        test('starts with the default tab, first by position', async () => {
            const repo = makeRepo();
            const tabs = await repo.findAll();
            expect(tabs.length).toBe(1);
            expect(tabs[0]?.id).toBe(DEFAULT_SOMEDAY_TAB_ID);
            expect(tabs[0]?.name).toBe('Someday');
            expect(tabs[0]?.projectTag).toBeNull();
            expect(tabs[0]?.position).toBe(0);
        });

        test('finds the default tab by id', async () => {
            const repo = makeRepo();
            const tab = await repo.findById(DEFAULT_SOMEDAY_TAB_ID);
            expect(tab?.id).toBe(DEFAULT_SOMEDAY_TAB_ID);
        });
    });

    describe('create', () => {
        test('creates a plain tab with generated id and createdAt', async () => {
            const repo = makeRepo();
            const tab = await repo.create({ name: 'Work', position: 1 });
            expect(tab.id).toBeDefined();
            expect(tab.id).not.toBe(DEFAULT_SOMEDAY_TAB_ID);
            expect(tab.createdAt).toBeDefined();
            expect(tab.name).toBe('Work');
            expect(tab.position).toBe(1);
            expect(tab.projectTag).toBeNull();
        });

        test('creates a project tab carrying the project tag', async () => {
            const repo = makeRepo();
            const tab = await repo.create({
                name: 'Build house',
                position: 2,
                projectTag: 'project:build-house',
            });
            expect(tab.projectTag).toBe('project:build-house');
        });

        test('assigns sequential ids', async () => {
            const repo = makeRepo();
            const a = await repo.create({ name: 'A', position: 1 });
            const b = await repo.create({ name: 'B', position: 2 });
            expect(a.id).not.toBe(b.id);
        });
    });

    describe('findAll', () => {
        test('returns tabs sorted by position', async () => {
            const repo = makeRepo();
            await repo.create({ name: 'C', position: 3 });
            await repo.create({ name: 'A', position: 1 });
            await repo.create({ name: 'B', position: 2 });
            const tabs = await repo.findAll();
            expect(tabs.map(t => t.name)).toEqual(['Someday', 'A', 'B', 'C']);
        });
    });

    describe('findById', () => {
        test('returns null for unknown id', async () => {
            const repo = makeRepo();
            expect(await repo.findById('nope')).toBeNull();
        });

        test('returns the tab when found', async () => {
            const repo = makeRepo();
            const created = await repo.create({ name: 'Work', position: 1 });
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
            const created = await repo.create({ name: 'Work', position: 1 });
            const updated = await repo.update(created.id, { name: 'Updated' });
            expect(updated?.name).toBe('Updated');
            expect(updated?.position).toBe(1);
            expect(updated?.projectTag).toBeNull();
        });

        test('sets and clears the project tag', async () => {
            const repo = makeRepo();
            const created = await repo.create({ name: 'Work', position: 1 });
            const tagged = await repo.update(created.id, { projectTag: 'project:x' });
            expect(tagged?.projectTag).toBe('project:x');
            const cleared = await repo.update(created.id, { projectTag: null });
            expect(cleared?.projectTag).toBeNull();
        });
    });

    describe('delete', () => {
        test('returns false for unknown id', async () => {
            const repo = makeRepo();
            expect(await repo.delete('nope')).toBe(false);
        });

        test('returns true and removes the tab (the default guard lives at the route)', async () => {
            const repo = makeRepo();
            const tab = await repo.create({ name: 'Work', position: 1 });
            expect(await repo.delete(tab.id)).toBe(true);
            expect(await repo.findById(tab.id)).toBeNull();
        });
    });

    describe('replaceAll (restore write path)', () => {
        test('replaces every tab verbatim', async () => {
            const repo = makeRepo();
            await repo.create({ name: 'Old tab', position: 1 });
            await repo.replaceAll([
                {
                    id: 't7',
                    name: 'From backup',
                    position: 3,
                    projectTag: 'project:backup',
                    createdAt: '2026-01-01T00:00:00.000Z',
                },
            ]);
            const all = await repo.findAll();
            expect(all.length).toBe(1);
            expect(all[0]?.id).toBe('t7');
            expect(all[0]?.projectTag).toBe('project:backup');
            expect(all[0]?.position).toBe(3);
        });
    });
}
