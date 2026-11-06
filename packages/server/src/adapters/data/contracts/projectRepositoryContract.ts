/**
 * ProjectRepository contract tests (see ADR-003)
 *
 * The same suite runs against every ProjectRepository implementation
 * (InMemoryProjectRepository, SqliteProjectRepository) to guarantee
 * behavioral parity.
 */

import { describe, expect, test } from 'bun:test';
import type { ProjectRepository } from '../ProjectRepository';

export function runProjectRepositoryContractTests(makeRepo: () => ProjectRepository): void {
    describe('create', () => {
        test('creates with generated id, createdAt, completedAt: null', async () => {
            const repo = makeRepo();
            const project = await repo.create({ name: 'My Project' });
            expect(project.id).toBeDefined();
            expect(project.createdAt).toBeDefined();
            expect(project.name).toBe('My Project');
            expect(project.completedAt).toBeNull();
            expect(project.description).toBeNull();
            expect(project.startDate).toBeNull();
            expect(project.dueDate).toBeNull();
        });

        test('creates with optional fields', async () => {
            const repo = makeRepo();
            const project = await repo.create({
                name: 'Full Project',
                description: 'Has all fields',
                startDate: '2026-04-01',
                dueDate: '2026-04-30',
            });
            expect(project.description).toBe('Has all fields');
            expect(project.startDate).toBe('2026-04-01');
            expect(project.dueDate).toBe('2026-04-30');
        });
    });

    describe('findAll', () => {
        test('returns empty array when no projects exist', async () => {
            const repo = makeRepo();
            expect(await repo.findAll()).toEqual([]);
        });

        test('returns all projects', async () => {
            const repo = makeRepo();
            await repo.create({ name: 'A' });
            await repo.create({ name: 'B' });
            expect((await repo.findAll()).length).toBe(2);
        });
    });

    describe('findById', () => {
        test('returns null for unknown id', async () => {
            const repo = makeRepo();
            expect(await repo.findById('nope')).toBeNull();
        });

        test('returns the project when found', async () => {
            const repo = makeRepo();
            const created = await repo.create({ name: 'Test' });
            expect(await repo.findById(created.id)).toEqual(created);
        });
    });

    describe('update', () => {
        test('returns null for unknown id', async () => {
            const repo = makeRepo();
            expect(await repo.update('nope', { name: 'New' })).toBeNull();
        });

        test('updates only provided fields', async () => {
            const repo = makeRepo();
            const created = await repo.create({ name: 'Original' });
            const updated = await repo.update(created.id, {
                completedAt: '2026-04-06T00:00:00.000Z',
            });
            expect(updated?.completedAt).toBe('2026-04-06T00:00:00.000Z');
            expect(updated?.name).toBe('Original');
        });

        test('creates with the hill at 0 and drags it along the update path', async () => {
            const repo = makeRepo();
            const created = await repo.create({ name: 'Hill' });
            expect(created.hillPosition).toBe(0);
            const updated = await repo.update(created.id, { hillPosition: 60 });
            expect(updated?.hillPosition).toBe(60);
            // The hill never moves on its own (ADR-011).
            const untouched = await repo.update(created.id, { name: 'Hill 2' });
            expect(untouched?.hillPosition).toBe(60);
        });
    });

    describe('delete', () => {
        describe('replaceAll (restore write path)', () => {
            test('replaces every project verbatim', async () => {
                const repo = makeRepo();
                await repo.create({ name: 'Old project' });
                await repo.replaceAll([
                    {
                        id: 'p9',
                        name: 'From backup',
                        tag: 'project:backup',
                        description: null,
                        startDate: null,
                        dueDate: null,
                        hillPosition: 30,
                        createdAt: '2026-01-01T00:00:00.000Z',
                        completedAt: null,
                    },
                ]);
                expect(await repo.findAll()).toEqual([expect.objectContaining({ id: 'p9' })]);
            });
        });

        test('returns false for unknown id', async () => {
            const repo = makeRepo();
            expect(await repo.delete('nope')).toBe(false);
        });

        test('returns true and removes the project', async () => {
            const repo = makeRepo();
            const project = await repo.create({ name: 'Test' });
            expect(await repo.delete(project.id)).toBe(true);
            expect(await repo.findById(project.id)).toBeNull();
        });
    });
}
