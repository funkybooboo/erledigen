/**
 * Project API routes
 */

import type { Logger } from '@erledigen/shared';
import {
    API_ROUTES,
    type CreateProjectInput,
    type UpdateProjectInput,
    type WsServerEventMap,
} from '@erledigen/shared';
import type { ProjectRepository } from '../adapters/data/ProjectRepository';
import type { HttpServer } from '../adapters/http/HttpServer';
import { CreateProjectSchema, UpdateProjectSchema } from '../openapi/schemas/project';
import { formatProjectsAsText } from '../presentation/formatters';
import type { EventBus } from '../services/EventBus';
import { notFoundError } from '../utils/errorHandler';
import {
    requirePathParam,
    respondNegotiated,
    successResponse,
    withErrorHandling,
} from '../utils/routeHelpers';
import { parseBody } from '../utils/validate';

export function registerProjectRoutes(
    server: HttpServer,
    projectRepo: ProjectRepository,
    eventBus: EventBus<WsServerEventMap>,
    logger: Logger,
): void {
    // GET /api/projects
    server.route(
        'GET',
        API_ROUTES.PROJECTS,
        withErrorHandling(async req => {
            const projects = await projectRepo.findAll();
            return respondNegotiated(req, projects, formatProjectsAsText);
        }, logger),
    );

    // POST /api/projects
    server.route(
        'POST',
        API_ROUTES.PROJECTS,
        withErrorHandling(async req => {
            const originClientId = req.headers['x-client-id'];
            const raw = await req.json<unknown>();
            const input = parseBody(CreateProjectSchema, raw) as CreateProjectInput;
            const project = await projectRepo.create(input);
            eventBus.publish('project:created', { project }, originClientId);
            return successResponse(project, 201);
        }, logger),
    );

    // GET /api/projects/:id
    server.route(
        'GET',
        API_ROUTES.PROJECT_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(req, API_ROUTES.PROJECT_ROUTE_PATTERN, 'project');
            const project = await projectRepo.findById(id);
            if (!project) throw notFoundError('Project', id);
            return successResponse(project);
        }, logger),
    );

    // PUT /api/projects/:id
    server.route(
        'PUT',
        API_ROUTES.PROJECT_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(req, API_ROUTES.PROJECT_ROUTE_PATTERN, 'project');
            const originClientId = req.headers['x-client-id'];
            const raw = await req.json<unknown>();
            const input = parseBody(UpdateProjectSchema, raw) as UpdateProjectInput;
            const project = await projectRepo.update(id, input);
            if (!project) throw notFoundError('Project', id);
            eventBus.publish('project:updated', { project }, originClientId);
            return successResponse(project);
        }, logger),
    );

    // DELETE /api/projects/:id
    server.route(
        'DELETE',
        API_ROUTES.PROJECT_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(req, API_ROUTES.PROJECT_ROUTE_PATTERN, 'project');
            const originClientId = req.headers['x-client-id'];
            const deleted = await projectRepo.delete(id);
            if (!deleted) throw notFoundError('Project', id);
            eventBus.publish('project:deleted', { id }, originClientId);
            return successResponse({ success: true });
        }, logger),
    );
}
