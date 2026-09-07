/**
 * ExportService tests -- snapshot assembly and format dispatch.
 *
 * Real in-memory repositories (no mocks): the snapshot must reflect what
 * the repositories actually return, including the trash.
 */

import { describe, expect, test } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { InMemoryProjectRepository } from '../adapters/data/InMemoryProjectRepository';
import { InMemoryRecurringTaskRepository } from '../adapters/data/InMemoryRecurringTaskRepository';
import { InMemorySomeDayGroupRepository } from '../adapters/data/InMemorySomeDayGroupRepository';
import { InMemoryTaskRepository } from '../adapters/data/InMemoryTaskRepository';
import { InMemoryUserPreferencesRepository } from '../adapters/data/InMemoryUserPreferencesRepository';
import { ExportService } from './ExportService';

function makeService() {
    const dateProvider = new NativeDateProvider();
    const taskRepo = new InMemoryTaskRepository(dateProvider);
    const someDayGroupRepo = new InMemorySomeDayGroupRepository(dateProvider);
    const projectRepo = new InMemoryProjectRepository(dateProvider);
    const recurringTaskRepo = new InMemoryRecurringTaskRepository(dateProvider);
    const preferencesRepo = new InMemoryUserPreferencesRepository(dateProvider);
    const service = new ExportService(
        taskRepo,
        someDayGroupRepo,
        projectRepo,
        recurringTaskRepo,
        preferencesRepo,
        dateProvider,
    );
    return { service, taskRepo, someDayGroupRepo, projectRepo, recurringTaskRepo };
}

describe('ExportService', () => {
    test('buildSnapshot includes every entity kind AND the trash', async () => {
        const { service, taskRepo } = makeService();
        const task = await taskRepo.create({ text: 'Buy milk', date: '2026-01-15' });
        const trashed = await taskRepo.create({ text: 'Gone', date: '2026-01-15' });
        await taskRepo.delete(trashed.id);

        const snapshot = await service.buildSnapshot();

        expect(snapshot.format).toBe('erledigen-export');
        expect(snapshot.version).toBe(1);
        expect(snapshot.tasks.map(t => t.id)).toContain(task.id);
        // Soft-deleted rows stay in the snapshot -- a backup that loses the
        // trash is not lossless.
        const trashedRow = snapshot.tasks.find(t => t.id === trashed.id);
        expect(trashedRow?.deletedAt).not.toBeNull();
        expect(snapshot.userPreferences.id).toBe('default');
    });

    test('buildSnapshot stamps exportedAt with the date provider timestamp', async () => {
        const { service } = makeService();
        const snapshot = await service.buildSnapshot();
        expect(new Date(snapshot.exportedAt).toString()).not.toBe('Invalid Date');
    });

    test('exportAs json returns the pretty-printed canonical snapshot', async () => {
        const { service, taskRepo } = makeService();
        await taskRepo.create({ text: 'Buy milk', date: '2026-01-15' });

        const doc = await service.exportAs('json');

        expect(doc.contentType).toBe('application/json');
        expect(JSON.parse(doc.body).format).toBe('erledigen-export');
    });

    test('exportAs csv writes a header row and honors custom columns', async () => {
        const { service, taskRepo } = makeService();
        await taskRepo.create({ text: 'Buy milk', date: '2026-01-15' });

        const doc = await service.exportAs('csv', ['text', 'date']);

        expect(doc.contentType).toBe('text/csv');
        const lines = doc.body.split('\r\n');
        expect(lines[0]).toBe('text,date');
        expect(lines[1]).toBe('Buy milk,2026-01-15');
    });

    test('exportAs md and ics dispatch to their adapters', async () => {
        const { service, taskRepo } = makeService();
        await taskRepo.create({ text: 'Buy milk', date: '2026-01-15' });

        const md = await service.exportAs('md');
        expect(md.contentType).toBe('text/markdown');
        expect(md.body).toContain('## 2026-01-15');

        const ics = await service.exportAs('ics');
        expect(ics.contentType).toBe('text/calendar');
        expect(ics.body).toContain('BEGIN:VCALENDAR');
    });

    test('the filename carries the export date and format extension', async () => {
        const { service } = makeService();

        const doc = await service.exportAs('json');

        expect(doc.filename).toMatch(/^erledigen-export-\d{4}-\d{2}-\d{2}\.json$/);
    });
});
