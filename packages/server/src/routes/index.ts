/**
 * Route registration orchestrator
 *
 * Imports all route modules and registers them against the HTTP server.
 * Add new route modules here as they are created.
 */

import type { Logger } from '@erledigen/shared';
import type { HttpServer } from '../adapters/http/HttpServer';
import type { HttpResponse } from '../adapters/http/types';
import type { Container } from '../container';
import { APP_VERSION } from '../version';
import { registerHealthRoutes, type ServerStatusDeps } from './healthRoutes';
import { registerMetricsRoutes } from './metricsRoutes';
import { registerOpenApiRoutes } from './openApiRoutes';
import { registerProjectRoutes } from './projectRoutes';
import { registerRecurringTaskRoutes } from './recurringTaskRoutes';
import { registerSomeDayGroupRoutes } from './someDayGroupRoutes';
import { registerTagRoutes } from './tagRoutes';
import { registerTaskRoutes } from './taskRoutes';
import { registerUserPreferencesRoutes } from './userPreferencesRoutes';

export function registerAllRoutes(server: HttpServer, container: Container): void {
    const logger: Logger = container.logger;

    // Root endpoint: plain greeting. The prod proxy never routes '/' to
    // the server (Caddy serves the client there), so this is a dev/API
    // convenience -- registered here so every route registration lives in
    // one place and the route-parity test can see it.
    server.route('GET', '/', async (): Promise<HttpResponse> => {
        return { status: 200, headers: {}, body: 'Hello from Bun Server!' };
    });

    const statusDeps: ServerStatusDeps = {
        version: container.config.get('APP_VERSION', APP_VERSION),
        startedAt: container.startedAt,
        storageAdapter: container.storageAdapter,
        sqliteConnection: container.storageAdapter === 'sqlite' ? container.sqliteConnection : null,
        connectionManager: container.connectionManager,
        taskRepository: container.taskRepository,
        jobQueue: container.jobQueue,
    };

    registerOpenApiRoutes(server);
    registerHealthRoutes(server, statusDeps);
    // The metrics endpoint only exists when collection is on; a disabled
    // endpoint 404s instead of serving an empty payload (see ADR-005).
    if (container.metricsEnabled) {
        registerMetricsRoutes(server, container.metricsAdapter, statusDeps);
    }
    registerTaskRoutes(
        server,
        container.taskRepository,
        container.taskService,
        container.eventBus,
        logger,
        container.recurringTaskService,
    );
    registerSomeDayGroupRoutes(
        server,
        container.someDayGroupRepository,
        container.eventBus,
        logger,
    );
    registerProjectRoutes(
        server,
        container.projectRepository,
        container.projectService,
        container.eventBus,
        logger,
    );
    registerRecurringTaskRoutes(
        server,
        container.recurringTaskRepository,
        container.recurringTaskService,
        container.eventBus,
        logger,
    );
    registerTagRoutes(server, container.tagService, container.eventBus, logger);
    registerUserPreferencesRoutes(server, container.userPreferencesRepository, logger);
}
