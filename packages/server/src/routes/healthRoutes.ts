/**
 * Health endpoint (see ADR-005)
 *
 * Rich health for uptime monitors: status, version, uptime, database
 * details, connection counts, and job queue depth. Deliberately NOT
 * Prometheus metrics -- those live on /api/metrics; health stays a simple
 * status check.
 */

import { API_ROUTES } from '@erledigen/shared';
import type { SqliteConnection } from '../adapters/data/sqliteConnection';
import type { TaskRepository } from '../adapters/data/TaskRepository';
import type { HttpServer } from '../adapters/http/HttpServer';
import type { JobQueue } from '../adapters/jobs/JobQueue';
import type { ConnectionManager } from '../adapters/ws/ConnectionManager';

/** Live server status the health and metrics endpoints both need.
 *  Values are read per request (counts change over time); the version and
 *  uptime origin are fixed per process. */
export interface ServerStatusDeps {
    version: string;
    startedAt: number;
    storageAdapter: 'sqlite' | 'memory';
    /** Null when running on the memory adapter. */
    sqliteConnection: SqliteConnection | null;
    connectionManager: ConnectionManager;
    taskRepository: TaskRepository;
    jobQueue: JobQueue;
}

/** Health payload (wrapped in the standard ApiResponse envelope by the
 *  route handler). */
export interface HealthData {
    status: 'ok';
    version: string;
    uptime: number;
    database: {
        type: 'sqlite' | 'memory';
        path: string | null;
        sizeBytes: number | null;
    };
    connections: {
        websocket: number;
    };
    jobs: {
        pending: number;
        running: number;
    };
}

export async function buildHealthData(deps: ServerStatusDeps): Promise<HealthData> {
    const sqlite = deps.storageAdapter === 'sqlite' ? deps.sqliteConnection : null;
    const queueStats = await deps.jobQueue.getStats();
    return {
        status: 'ok',
        version: deps.version,
        uptime: Math.max(0, Math.round((Date.now() - deps.startedAt) / 1000)),
        database: {
            type: deps.storageAdapter,
            path: sqlite ? sqlite.dbPath : null,
            sizeBytes: sqlite ? sqlite.sizeBytes() : null,
        },
        connections: {
            websocket: deps.connectionManager.size(),
        },
        jobs: {
            pending: queueStats.pending,
            running: queueStats.running,
        },
    };
}

export function registerHealthRoutes(server: HttpServer, deps: ServerStatusDeps): void {
    server.route('GET', API_ROUTES.HEALTH, async () => {
        const data = await buildHealthData(deps);
        return { status: 200, headers: {}, body: { data } };
    });
}
