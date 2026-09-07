/**
 * ImportService tests (ADR-009).
 *
 * The service is exercised against BOTH storage wirings, like the
 * repository contract suites: in-memory (identity transaction) and
 * SQLite (a real transaction -- a mid-restore failure must roll every
 * replaceAll back, proving the transaction is not a no-op).
 */

import { afterAll, describe, expect, test } from 'bun:test';
import type { ExportSnapshot, Task } from '@erledigen/shared';
import { NativeDateProvider } from '@erledigen/shared';
import type { PreRestoreBackupWriter } from '../adapters/backup/PreRestoreBackupWriter';
import { InMemoryProjectRepository } from '../adapters/data/InMemoryProjectRepository';
import { InMemoryRecurringTaskRepository } from '../adapters/data/InMemoryRecurringTaskRepository';
import { InMemorySomeDayGroupRepository } from '../adapters/data/InMemorySomeDayGroupRepository';
import { InMemoryTaskRepository } from '../adapters/data/InMemoryTaskRepository';
import { InMemoryUserPreferencesRepository } from '../adapters/data/InMemoryUserPreferencesRepository';
import {
    InMemorySnapshotRestoreWriter,
    SqliteSnapshotRestoreWriter,
} from '../adapters/data/SnapshotRestoreWriter';
import { SqliteProjectRepository } from '../adapters/data/SqliteProjectRepository';
import { SqliteRecurringTaskRepository } from '../adapters/data/SqliteRecurringTaskRepository';
import { SqliteSomeDayGroupRepository } from '../adapters/data/SqliteSomeDayGroupRepository';
import { SqliteTaskRepository } from '../adapters/data/SqliteTaskRepository';
import { SqliteUserPreferencesRepository } from '../adapters/data/SqliteUserPreferencesRepository';
import { SqliteConnection } from '../adapters/data/sqliteConnection';
import type { TaskRepository } from '../adapters/data/TaskRepository';
import type { UserPreferencesRepository } from '../adapters/data/UserPreferencesRepository';
import { ExportService } from './ExportService';
import { ImportService } from './ImportService';

const dateProvider = new NativeDateProvider();

/** Backs up snapshots in memory; lets tests assert the pre-restore write. */
class RecordingBackupWriter implements PreRestoreBackupWriter {
    public written: ExportSnapshot[] = [];

    write(snapshot: ExportSnapshot): Promise<string | null> {
        this.written.push(snapshot);
        return Promise.resolve(null);
    }
}

/** Throwing writer to prove a failed backup aborts the restore. */
class ThrowingBackupWriter implements PreRestoreBackupWriter {
    write(): Promise<string | null> {
        throw new Error('backup volume is full');
    }
}

interface Wiring {
    taskRepo: TaskRepository;
    preferencesRepo: UserPreferencesRepository;
    service: ImportService;
    backupWriter: RecordingBackupWriter;
}

function makeInMemoryWiring(): Wiring {
    const taskRepo = new InMemoryTaskRepository(dateProvider);
    const groupRepo = new InMemorySomeDayGroupRepository(dateProvider);
    const projectRepo = new InMemoryProjectRepository(dateProvider);
    const recurringRepo = new InMemoryRecurringTaskRepository(dateProvider);
    const preferencesRepo = new InMemoryUserPreferencesRepository(dateProvider);
    const exportService = new ExportService(
        taskRepo,
        groupRepo,
        projectRepo,
        recurringRepo,
        preferencesRepo,
        dateProvider,
    );
    const backupWriter = new RecordingBackupWriter();
    return {
        taskRepo,
        preferencesRepo,
        backupWriter,
        service: new ImportService(
            taskRepo,
            exportService,
            new InMemorySnapshotRestoreWriter(
                taskRepo,
                groupRepo,
                projectRepo,
                recurringRepo,
                preferencesRepo,
            ),
            backupWriter,
        ),
    };
}

const connections: SqliteConnection[] = [];

function makeSqliteWiring(): Wiring {
    const connection = new SqliteConnection(':memory:');
    connections.push(connection);
    const taskRepo = new SqliteTaskRepository(connection.db, dateProvider);
    const groupRepo = new SqliteSomeDayGroupRepository(connection.db, dateProvider);
    const projectRepo = new SqliteProjectRepository(connection.db, dateProvider);
    const recurringRepo = new SqliteRecurringTaskRepository(connection.db, dateProvider);
    const preferencesRepo = new SqliteUserPreferencesRepository(connection.db, dateProvider);
    const exportService = new ExportService(
        taskRepo,
        groupRepo,
        projectRepo,
        recurringRepo,
        preferencesRepo,
        dateProvider,
    );
    const backupWriter = new RecordingBackupWriter();
    return {
        taskRepo,
        preferencesRepo,
        backupWriter,
        service: new ImportService(
            taskRepo,
            exportService,
            new SqliteSnapshotRestoreWriter(
                connection,
                taskRepo,
                groupRepo,
                projectRepo,
                recurringRepo,
                preferencesRepo,
            ),
            backupWriter,
        ),
    };
}

afterAll(() => {
    for (const connection of connections) connection.close();
});

/** A snapshot built from live repos (round-trip realistic). */
async function buildSnapshot(wiring: Wiring): Promise<ExportSnapshot> {
    await wiring.taskRepo.create({ text: 'Pre-restore task', date: '2026-04-06' });
    const doomed = await wiring.taskRepo.create({ text: 'Trashed before restore', date: null });
    await wiring.taskRepo.delete(doomed.id);
    const prefs = await wiring.preferencesRepo.get();
    const snapshot: ExportSnapshot = {
        format: 'erledigen-export',
        version: 1,
        exportedAt: dateProvider.timestamp(),
        tasks: [...(await wiring.taskRepo.findAll()), ...(await wiring.taskRepo.findDeleted())],
        someDayGroups: [],
        projects: [],
        recurringTasks: [],
        userPreferences: { ...prefs, theme: 'dark' },
    };
    return snapshot;
}

for (const [name, makeWiring] of [
    ['in-memory', makeInMemoryWiring],
    ['sqlite', makeSqliteWiring],
] as const) {
    describe(`ImportService (${name})`, () => {
        test('restore replaces all data and reports counts', async () => {
            const wiring = makeWiring();
            const snapshot = await buildSnapshot(wiring);
            // Make the restore observable: a task created AFTER the
            // snapshot must be GONE after the restore.
            await wiring.taskRepo.create({ text: 'Post-snapshot', date: '2026-04-07' });

            const result = await wiring.service.restore(JSON.stringify(snapshot));

            expect(result.mode).toBe('restore');
            expect(result.restored?.tasks).toBe(snapshot.tasks.length);
            expect(result.restored?.preferences).toBe(true);
            const texts = (await wiring.taskRepo.findAll()).map((t: Task) => t.text);
            expect(texts).not.toContain('Post-snapshot');
            expect(texts).toContain('Pre-restore task');
            expect(await wiring.taskRepo.findDeleted()).toHaveLength(1); // trash restored
            expect((await wiring.preferencesRepo.get()).theme).toBe('dark');
        });

        test('restore writes the pre-restore backup BEFORE wiping', async () => {
            const wiring = makeWiring();
            await wiring.taskRepo.create({ text: 'Will be backed up', date: null });

            await wiring.service.restore(
                JSON.stringify({
                    format: 'erledigen-export',
                    version: 1,
                    exportedAt: dateProvider.timestamp(),
                    tasks: [],
                    someDayGroups: [],
                    projects: [],
                    recurringTasks: [],
                    userPreferences: await wiring.preferencesRepo.get(),
                }),
            );

            expect(wiring.backupWriter.written.length).toBe(1);
            expect(
                wiring.backupWriter.written[0]?.tasks.some(t => t.text === 'Will be backed up'),
            ).toBe(true);
        });

        test('a rejected snapshot wipes nothing', async () => {
            const wiring = makeWiring();
            const keeper = await wiring.taskRepo.create({ text: 'Survivor', date: null });
            await expect(
                wiring.service.restore(JSON.stringify({ format: 'nope', version: 1 })),
            ).rejects.toThrow();
            expect(await wiring.taskRepo.findById(keeper.id)).not.toBeNull();
            expect(wiring.backupWriter.written.length).toBe(0); // no backup either
        });

        test('a failed backup aborts the restore before any write', async () => {
            const wiring = makeWiring();
            const keeper = await wiring.taskRepo.create({ text: 'Survivor', date: null });
            const snapshot = await buildSnapshot(wiring);
            const failing = new ImportService(
                wiring.taskRepo,
                new ExportService(
                    wiring.taskRepo,
                    new InMemorySomeDayGroupRepository(dateProvider),
                    new InMemoryProjectRepository(dateProvider),
                    new InMemoryRecurringTaskRepository(dateProvider),
                    wiring.preferencesRepo,
                    dateProvider,
                ),
                new InMemorySnapshotRestoreWriter(
                    wiring.taskRepo,
                    new InMemorySomeDayGroupRepository(dateProvider),
                    new InMemoryProjectRepository(dateProvider),
                    new InMemoryRecurringTaskRepository(dateProvider),
                    wiring.preferencesRepo,
                ),
                new ThrowingBackupWriter(),
            );
            await expect(failing.restore(JSON.stringify(snapshot))).rejects.toThrow(
                'backup volume is full',
            );
            expect(await wiring.taskRepo.findById(keeper.id)).not.toBeNull();
        });

        test('importTasks creates tasks, subtasks, and keeps completion', async () => {
            const wiring = makeWiring();
            const outcome = await wiring.service.importTasks(
                'todoist-csv',
                [
                    'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,DATE',
                    'task,Top task,With description,2,1,2026-03-14',
                    'task,Child task,,3,2,',
                    'task,Level three,,4,3,',
                ].join('\r\n'),
            );

            expect(outcome.result.mode).toBe('import');
            expect(outcome.result.created).toBe(3);
            const top = outcome.createdTasks.find(t => t.text === 'Top task');
            expect(top?.tags).toContain('p2');
            const child = await wiring.taskRepo.findChildren(top?.id ?? '');
            expect(child.map(t => t.text)).toEqual(['Child task']);
            expect(child[0]?.tags).toContain('p3');
        });

        test('importTasks lands canceled rows in the trash', async () => {
            const wiring = makeWiring();
            const outcome = await wiring.service.importTasks(
                'things-json',
                JSON.stringify([
                    {
                        uuid: 'u1',
                        type: 'to-do',
                        title: 'Canceled in Things',
                        status: 'canceled',
                        start: 'Someday',
                        start_date: null,
                        deadline: null,
                        stop_date: null,
                        created: '2026-01-01 00:00:00',
                        modified: '2026-01-01 00:00:00',
                    },
                ]),
            );

            expect(outcome.canceledIds).toHaveLength(1);
            const [id] = outcome.canceledIds;
            expect(id).toBeDefined();
            expect(await wiring.taskRepo.findById(id ?? '')).toBeNull(); // active view
            expect((await wiring.taskRepo.findDeleted()).map(t => t.id)).toEqual(
                outcome.canceledIds,
            );
            expect(await wiring.taskRepo.restore(id ?? '')).not.toBeNull(); // restorable
        });

        test('importTasks surfaces parse warnings without failing', async () => {
            const wiring = makeWiring();
            const outcome = await wiring.service.importTasks(
                'csv',
                'text,date\nGood row,2026-01-01\nBad date row,01/02/2026\n',
            );
            expect(outcome.result.created).toBe(1);
            expect(outcome.result.warnings.length).toBe(1);
            expect(outcome.result.warnings[0]?.source).toBe(3);
        });

        test('importTasks on an empty source creates nothing', async () => {
            const wiring = makeWiring();
            const outcome = await wiring.service.importTasks('things-json', '[]');
            expect(outcome.result.created).toBe(0);
            expect(outcome.createdTasks).toEqual([]);
        });

        test('imported tasks have no deletedAt (active) unless canceled', async () => {
            const wiring = makeWiring();
            await wiring.service.importTasks(
                'things-json',
                JSON.stringify([
                    {
                        uuid: 'u2',
                        type: 'to-do',
                        title: 'Live one',
                        status: 'incomplete',
                        start: 'Anytime',
                        start_date: '2026-02-02',
                        deadline: null,
                        stop_date: null,
                        created: '2026-01-01 00:00:00',
                        modified: '2026-01-01 00:00:00',
                    },
                ]),
            );
            const all = await wiring.taskRepo.findAll();
            expect(all).toHaveLength(1);
            expect(all[0]?.deletedAt).toBeNull();
            expect(all[0]?.date).toBe('2026-02-02');
        });
    });
}

describe('ImportService (sqlite transaction atomicity)', () => {
    test('a mid-restore failure rolls every table back', async () => {
        // Fresh concrete SQLite wiring (the writer needs the concrete
        // repositories for their synchronous replaceAllSync cores).
        const connection = new SqliteConnection(':memory:');
        connections.push(connection);
        const taskRepo = new SqliteTaskRepository(connection.db, dateProvider);
        const groupRepo = new SqliteSomeDayGroupRepository(connection.db, dateProvider);
        const projectRepo = new SqliteProjectRepository(connection.db, dateProvider);
        const recurringRepo = new SqliteRecurringTaskRepository(connection.db, dateProvider);
        const prefsRepo = new SqliteUserPreferencesRepository(connection.db, dateProvider);

        const keeper = await taskRepo.create({ text: 'Survivor', date: null });
        const snapshot: ExportSnapshot = {
            format: 'erledigen-export',
            version: 1,
            exportedAt: dateProvider.timestamp(),
            tasks: [...(await taskRepo.findAll()), ...(await taskRepo.findDeleted())],
            someDayGroups: [],
            projects: [],
            recurringTasks: [],
            userPreferences: await prefsRepo.get(),
        };

        // Inject a write failure AFTER tasks are already replaced: a
        // stub prefs repo throws from restoreSync inside the single
        // restore transaction. (Bad snapshots cannot reach the writer --
        // the adapter rejects them with a 400 -- so the stub stands in
        // for any low-level write failure, e.g. a full disk.)
        const writer = new SqliteSnapshotRestoreWriter(
            connection,
            taskRepo,
            groupRepo,
            projectRepo,
            recurringRepo,
            {
                restoreSync: () => {
                    throw new Error('disk full');
                },
            } as unknown as SqliteUserPreferencesRepository,
        );

        await expect(writer.writeAll(snapshot)).rejects.toThrow('disk full');
        // Nothing was wiped: the pre-restore state survived the failure.
        expect(await taskRepo.findById(keeper.id)).not.toBeNull();
        expect((await taskRepo.findAll()).map(t => t.text)).toContain('Survivor');
    });
});
