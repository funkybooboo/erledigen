/**
 * Route registration orchestrator
 *
 * Imports all route modules and registers them against the HTTP server.
 * Add new route modules here as they are created.
 */

import type { Logger } from '@erledigen/shared';
import type { HttpServer } from '../adapters/http/HttpServer';
import type { Container } from '../container';
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

    const statusDeps: ServerStatusDeps = {
        version: container.config.get('APP_VERSION', '0.0.0'),
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
