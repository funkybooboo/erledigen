/**
 * Task API routes
 */

import type { Logger } from '@erledigen/shared';
import { API_ROUTES, type CreateTaskInput, type UpdateTaskInput } from '@erledigen/shared';
import type { TaskRepository } from '../adapters/data/TaskRepository';
import type { HttpServer } from '../adapters/http/HttpServer';
import { CreateTaskSchema, TaskQuerySchema, UpdateTaskSchema } from '../openapi/schemas/task';
import { formatTasksAsText } from '../presentation/formatters';
import type { EventBus } from '../services/EventBus';
import type { RecurringTaskService } from '../services/RecurringTaskService';
import type { TaskService } from '../services/TaskService';
import { notFoundError } from '../utils/errorHandler';
import {
    requirePathParam,
    respondNegotiated,
    successResponse,
    withErrorHandling,
} from '../utils/routeHelpers';
import { parseBody, parseQuery } from '../utils/validate';

export function registerTaskRoutes(
    server: HttpServer,
    taskRepo: TaskRepository,
    taskService: TaskService,
    eventBus: EventBus,
    logger: Logger,
    recurringTaskService: RecurringTaskService,
): void {
    /** Refresh habit streak stats for a task's template. Stats failures
     *  must never break the task mutation that triggered them. */
    const refreshStats = (recurringTaskId: string | null): void => {
        if (!recurringTaskId) return;
        recurringTaskService.computeStats(recurringTaskId).catch(error => {
            logger.warn('Failed to refresh recurring task stats', { error, recurringTaskId });
        });
    };

    // GET /api/tasks
    server.route(
        'GET',
        API_ROUTES.TASKS,
        withErrorHandling(async req => {
            const query = parseQuery(TaskQuerySchema, req.url);
            const tasks = await taskService.listTasks(query);
            return respondNegotiated(req, tasks, formatTasksAsText);
        }, logger),
    );

    // POST /api/tasks
    server.route(
        'POST',
        API_ROUTES.TASKS,
        withErrorHandling(async req => {
            const raw = await req.json<unknown>();
            const originClientId = req.headers['x-client-id'];
            const input = parseBody(CreateTaskSchema, raw) as CreateTaskInput;
            const task = await taskRepo.create(input);
            eventBus.publish('task:created', { task }, originClientId);
            return successResponse(task, 201);
        }, logger),
    );

    // DELETE /api/tasks/purge (must be before :id to avoid matching "purge" as an id)
    server.route(
        'DELETE',
        API_ROUTES.TASK_PURGE,
        withErrorHandling(async _req => {
            const purged = await taskService.purge();
            return successResponse({ purged });
        }, logger),
    );

    // GET /api/tasks/trash (must be before :id to avoid matching "trash" as an id)
    server.route(
        'GET',
        API_ROUTES.TASK_TRASH,
        withErrorHandling(async _req => {
            const tasks = await taskService.getTrash();
            return successResponse(tasks);
        }, logger),
    );

    // POST /api/tasks/:id/restore
    server.route(
        'POST',
        API_ROUTES.TASK_RESTORE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(req, API_ROUTES.TASK_RESTORE_PATTERN, 'task');
            const originClientId = req.headers['x-client-id'];
            const task = await taskRepo.restore(id);
            if (!task) throw notFoundError('Task', id);
            refreshStats(task.recurringTaskId);
            eventBus.publish('task:restored', { task }, originClientId);
            return successResponse(task);
        }, logger),
    );

    // GET /api/tasks/:id
    server.route(
        'GET',
        API_ROUTES.TASK_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(req, API_ROUTES.TASK_ROUTE_PATTERN, 'task');
            const task = await taskRepo.findById(id);
            if (!task) throw notFoundError('Task', id);
            return successResponse(task);
        }, logger),
    );

    // PUT /api/tasks/:id
    server.route(
        'PUT',
        API_ROUTES.TASK_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(req, API_ROUTES.TASK_ROUTE_PATTERN, 'task');
            const originClientId = req.headers['x-client-id'];
            const raw = await req.json<unknown>();
            const input = parseBody(UpdateTaskSchema, raw) as UpdateTaskInput;
            const task = await taskService.updateTask(id, input);
            if (!task) throw notFoundError('Task', id);
            refreshStats(task.recurringTaskId);
            eventBus.publish('task:updated', { task }, originClientId);
            return successResponse(task);
        }, logger),
    );

    // DELETE /api/tasks/:id (soft-delete)
    server.route(
        'DELETE',
        API_ROUTES.TASK_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(req, API_ROUTES.TASK_ROUTE_PATTERN, 'task');
            const originClientId = req.headers['x-client-id'];
            // Capture the template link before the instance disappears from
            // the active set (deleted instances no longer count for streaks).
            const existing = await taskRepo.findById(id);
            const deleted = await taskRepo.delete(id);
            if (!deleted) throw notFoundError('Task', id);
            refreshStats(existing?.recurringTaskId ?? null);
            eventBus.publish('task:deleted', { id }, originClientId);
            return successResponse({ success: true });
        }, logger),
    );
}
