import { describe, expect, it } from 'bun:test';
import { NativeDateProvider } from '@erledigen/shared';
import { InMemoryTaskRepository } from '../adapters/data/InMemoryTaskRepository';
import { InMemoryUserPreferencesRepository } from '../adapters/data/InMemoryUserPreferencesRepository';
import { TaskService } from './TaskService';

function makeService() {
    const dateProvider = new NativeDateProvider();
    const taskRepo = new InMemoryTaskRepository(dateProvider);
    const prefsRepo = new InMemoryUserPreferencesRepository(dateProvider);
    return { taskRepo, prefsRepo, service: new TaskService(taskRepo, prefsRepo) };
}

describe('TaskService.createTask', () => {
    it('defaults rolloverEnabled from the app-wide preference', async () => {
        const { taskRepo, service } = makeService();
        // Default preferences have rolloverEnabled: true.
        const task = await service.createTask({ text: 'Buy milk', date: '2026-09-05' });
        expect(task.rolloverEnabled).toBe(true);

        const persisted = await taskRepo.findById(task.id);
        expect(persisted?.rolloverEnabled).toBe(true);
    });

    it('follows the app-wide preference when the user turns rollover off', async () => {
        const { prefsRepo, service } = makeService();
        await prefsRepo.update({ rolloverEnabled: false });

        const task = await service.createTask({ text: 'Buy milk', date: '2026-09-05' });

        expect(task.rolloverEnabled).toBe(false);
    });

    it('keeps an explicit per-task override over the preference default', async () => {
        const { service } = makeService();
        const optingOut = await service.createTask({
            text: 'Do not roll me',
            date: '2026-09-05',
            rolloverEnabled: false,
        });

        expect(optingOut.rolloverEnabled).toBe(false);
    });
});
