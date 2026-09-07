/**
 * UserPreferencesRepository contract tests (see ADR-003)
 *
 * The same suite runs against every UserPreferencesRepository implementation
 * (InMemoryUserPreferencesRepository, SqliteUserPreferencesRepository) to
 * guarantee behavioral parity.
 */

import { describe, expect, test } from 'bun:test';
import type { UserPreferences } from '@erledigen/shared';
import type { UserPreferencesRepository } from '../UserPreferencesRepository';

export function runUserPreferencesRepositoryContractTests(
    makeRepo: () => UserPreferencesRepository,
): void {
    describe('get', () => {
        test('returns sensible defaults when preferences have never been set', async () => {
            const repo = makeRepo();
            const prefs = await repo.get();
            expect(prefs.id).toBe('default');
            expect(prefs.theme).toBe('system');
            expect(prefs.locale).toBe('en');
            expect(prefs.someDayPanelWidth).toBeGreaterThan(0);
            expect(prefs.someDayPanelCollapsed).toBe(false);
            expect(prefs.rolloverEnabled).toBe(true);
            expect(prefs.showEmptyDays).toBe(true);
            expect(prefs.activeFilters.tags).toEqual([]);
            expect(prefs.activeFilters.showCompleted).toBe(true);
            expect(prefs.tagKinds.length).toBeGreaterThan(0);
            expect(prefs.tagKindMap).toBeDefined();
        });
    });

    describe('update', () => {
        test('merges partial updates without clobbering other fields', async () => {
            const repo = makeRepo();
            await repo.update({ theme: 'dark' });
            const prefs = await repo.get();
            expect(prefs.theme).toBe('dark');
            expect(prefs.locale).toBe('en');
        });

        test('merges activeFilters as a whole object', async () => {
            const repo = makeRepo();
            await repo.update({
                activeFilters: {
                    tags: ['work', 'p1'],
                    showCompleted: true,
                },
            });
            const prefs = await repo.get();
            expect(prefs.activeFilters.tags).toEqual(['work', 'p1']);
        });

        test('updates tagKinds and tagKindMap', async () => {
            const repo = makeRepo();
            await repo.update({
                tagKinds: [
                    {
                        id: 'priority',
                        name: 'Priority',
                        behavior: 'single',
                        prefix: null,
                        sortOrder: 0,
                        color: null,
                    },
                    {
                        id: 'context',
                        name: 'Context',
                        behavior: 'multiple',
                        prefix: null,
                        sortOrder: 1,
                        color: null,
                    },
                ],
                tagKindMap: { p1: 'priority', p2: 'priority', work: 'context' },
            });
            const prefs = await repo.get();
            expect(prefs.tagKinds.length).toBe(2);
            const contextKind = prefs.tagKinds.find(k => k.id === 'context');
            expect(contextKind?.name).toBe('Context');
            expect(prefs.tagKindMap?.['work']).toBe('context');
        });

        test('updates updatedAt on each call', async () => {
            const repo = makeRepo();
            await repo.update({ theme: 'light' });
            const after = await repo.get();
            expect(after.updatedAt).toBeDefined();
            expect(typeof after.updatedAt).toBe('string');
        });
    });

    describe('reset', () => {
        describe('restore (ADR-009 restore write path)', () => {
            test('stores the snapshot preferences verbatim, updatedAt included', async () => {
                const repo = makeRepo();
                const current = await repo.get();
                const snapshotPrefs = {
                    ...current,
                    theme: 'dark',
                    someDayPanelWidth: 321,
                    timezone: 'America/Denver',
                    updatedAt: '2026-01-15T09:00:00.000Z',
                } as UserPreferences;
                await repo.restore(snapshotPrefs);
                const restored = await repo.get();
                expect(restored.theme).toBe('dark');
                expect(restored.someDayPanelWidth).toBe(321);
                expect(restored.timezone).toBe('America/Denver');
                expect(restored.updatedAt).toBe('2026-01-15T09:00:00.000Z');
            });
        });

        test('restores default preferences', async () => {
            const repo = makeRepo();
            await repo.update({ theme: 'dark', locale: 'fr' });
            await repo.reset();
            const prefs = await repo.get();
            expect(prefs.theme).toBe('system');
            expect(prefs.locale).toBe('en');
        });
    });

    describe('someDayPanelLastOpenWidth', () => {
        test('persists last open width', async () => {
            const repo = makeRepo();
            await repo.update({ someDayPanelLastOpenWidth: 350 });
            const prefs = await repo.get();
            expect(prefs.someDayPanelLastOpenWidth).toBe(350);
        });

        test('defaults to 280', async () => {
            const repo = makeRepo();
            const prefs = await repo.get();
            expect(prefs.someDayPanelLastOpenWidth).toBe(280);
        });
    });

    describe('activeFilters', () => {
        test('persists tag filters', async () => {
            const repo = makeRepo();
            await repo.update({
                activeFilters: {
                    tags: ['work', 'p1', 'project:build-erledigen'],
                    showCompleted: false,
                },
            });
            const prefs = await repo.get();
            expect(prefs.activeFilters.tags).toEqual(['work', 'p1', 'project:build-erledigen']);
            expect(prefs.activeFilters.showCompleted).toBe(false);
        });
    });
}
