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
            expect(prefs.activeFilters.sortMode).toBe('manual');
            expect(prefs.activeFilters.dateFrom).toBeNull();
            expect(prefs.activeFilters.dateTo).toBeNull();
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
                    sortMode: 'priority',
                    dateFrom: null,
                    dateTo: null,
                },
            });
            const prefs = await repo.get();
            expect(prefs.activeFilters.tags).toEqual(['work', 'p1']);
            expect(prefs.activeFilters.sortMode).toBe('priority');
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

        test('persists the accent scheme', async () => {
            const repo = makeRepo();
            await repo.update({ accent: 'coral' });
            const prefs = await repo.get();
            expect(prefs.accent).toBe('coral');
            // Partial update does not clobber the other theme field.
            expect(prefs.theme).toBe('system');
        });

        test('persists tag colors and merges the map as a whole', async () => {
            const repo = makeRepo();
            await repo.update({ tagColors: { work: 'sky', errands: 'amber' } });
            let prefs = await repo.get();
            expect(prefs.tagColors['work']).toBe('sky');
            expect(prefs.tagColors['errands']).toBe('amber');

            // A second update replaces the map wholesale (the client sends
            // the full map); keys not present are dropped.
            await repo.update({ tagColors: { work: 'violet' } });
            prefs = await repo.get();
            expect(prefs.tagColors['work']).toBe('violet');
            expect(prefs.tagColors['errands']).toBeUndefined();
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

            test('persists the appearance preferences', async () => {
                const repo = makeRepo();
                await repo.update({
                    fontSize: 'large',
                    rowDensity: 'compact',
                    completionAnimation: 'none',
                });
                const prefs = await repo.get();
                expect(prefs.fontSize).toBe('large');
                expect(prefs.rowDensity).toBe('compact');
                expect(prefs.completionAnimation).toBe('none');
            });

            test('persists shortcut overrides, shape-validated only', async () => {
                const repo = makeRepo();
                await repo.update({
                    shortcutOverrides: { openTrash: ['g z'], focusNext: ['j'] },
                });
                const prefs = await repo.get();
                expect(prefs.shortcutOverrides['openTrash']).toEqual(['g z']);
                // The map replaces wholesale, like tagColors.
                await repo.update({ shortcutOverrides: { focusNext: ['n'] } });
                const after = await repo.get();
                expect(after.shortcutOverrides['focusNext']).toEqual(['n']);
                expect(after.shortcutOverrides['openTrash']).toBeUndefined();
            });

            test('persists the fresh-start toggle without touching the filters', async () => {
                const repo = makeRepo();
                await repo.update({
                    activeFilters: {
                        tags: ['keep-me'],
                        showCompleted: true,
                        sortMode: 'manual',
                        dateFrom: null,
                        dateTo: null,
                    },
                    persistActiveFilters: false,
                });
                const prefs = await repo.get();
                expect(prefs.persistActiveFilters).toBe(false);
                // The filters themselves persist server-side; the CLIENT
                // clears them on load when the toggle is off.
                expect(prefs.activeFilters.tags).toEqual(['keep-me']);
            });

            test('fills the accent default when a pre-v0.11.0 snapshot has none', async () => {
                const repo = makeRepo();
                const current = await repo.get();
                // A v0.10.x export predates the accent field entirely.
                const legacy = {
                    ...current,
                    accent: undefined,
                    tagColors: undefined,
                    fontSize: undefined,
                    rowDensity: undefined,
                    completionAnimation: undefined,
                    persistActiveFilters: undefined,
                    shortcutOverrides: undefined,
                } as unknown as UserPreferences;
                await repo.restore(legacy);
                const prefs = await repo.get();
                expect(prefs.accent).toBe('blue');
                expect(prefs.tagColors).toEqual({});
                expect(prefs.fontSize).toBe('medium');
                expect(prefs.rowDensity).toBe('comfortable');
                expect(prefs.completionAnimation).toBe('flash');
                expect(prefs.persistActiveFilters).toBe(true);
                expect(prefs.shortcutOverrides).toEqual({});
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
                    sortMode: 'manual',
                    dateFrom: null,
                    dateTo: null,
                },
            });
            const prefs = await repo.get();
            expect(prefs.activeFilters.tags).toEqual(['work', 'p1', 'project:build-erledigen']);
            expect(prefs.activeFilters.showCompleted).toBe(false);
        });

        test('persists the sort mode and date range', async () => {
            const repo = makeRepo();
            await repo.update({
                activeFilters: {
                    tags: [],
                    showCompleted: true,
                    sortMode: 'priority',
                    dateFrom: '2026-10-01',
                    dateTo: '2026-10-31',
                },
            });
            const prefs = await repo.get();
            expect(prefs.activeFilters.sortMode).toBe('priority');
            expect(prefs.activeFilters.dateFrom).toBe('2026-10-01');
            expect(prefs.activeFilters.dateTo).toBe('2026-10-31');
        });

        test('normalizes an activeFilters shape that predates the newer fields', async () => {
            const repo = makeRepo();
            // Simulate an old persisted value (JSON column or an older
            // restored snapshot) that only knows tags/showCompleted.
            const current = await repo.get();
            const legacy = {
                ...current,
                activeFilters: {
                    tags: ['legacy'],
                    showCompleted: true,
                } as UserPreferences['activeFilters'],
            } as UserPreferences;
            await repo.restore(legacy);
            const prefs = await repo.get();
            expect(prefs.activeFilters.tags).toEqual(['legacy']);
            expect(prefs.activeFilters.showCompleted).toBe(true);
            expect(prefs.activeFilters.sortMode).toBe('manual');
            expect(prefs.activeFilters.dateFrom).toBeNull();
            expect(prefs.activeFilters.dateTo).toBeNull();
        });
    });
}
