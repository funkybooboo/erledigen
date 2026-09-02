/**
 * RecurringTask API routes
 */

import type { Logger } from '@erledigen/shared';
import {
    API_ROUTES,
    type CreateRecurringTaskInput,
    type UpdateRecurringTaskInput,
} from '@erledigen/shared';
import type { RecurringTaskRepository } from '../adapters/data/RecurringTaskRepository';
import type { HttpServer } from '../adapters/http/HttpServer';
import {
    CreateRecurringTaskSchema,
    GenerateInstancesSchema,
    UpdateRecurringTaskSchema,
} from '../openapi/schemas/recurringTask';
import { formatRecurringTasksAsText } from '../presentation/formatters';
import type { EventBus } from '../services/EventBus';
import type { RecurringTaskService } from '../services/RecurringTaskService';
import { notFoundError } from '../utils/errorHandler';
import {
    requirePathParam,
    respondNegotiated,
    successResponse,
    withErrorHandling,
} from '../utils/routeHelpers';
import { parseBody } from '../utils/validate';

export function registerRecurringTaskRoutes(
    server: HttpServer,
    recurringTaskRepo: RecurringTaskRepository,
    recurringTaskService: RecurringTaskService,
    eventBus: EventBus,
    logger: Logger,
): void {
    // GET /api/recurring-tasks
    server.route(
        'GET',
        API_ROUTES.RECURRING_TASKS,
        withErrorHandling(async req => {
            const tasks = await recurringTaskRepo.findAll();
            return respondNegotiated(req, tasks, formatRecurringTasksAsText);
        }, logger),
    );

    // POST /api/recurring-tasks
    server.route(
        'POST',
        API_ROUTES.RECURRING_TASKS,
        withErrorHandling(async req => {
            const raw = await req.json<unknown>();
            const input = parseBody(CreateRecurringTaskSchema, raw) as CreateRecurringTaskInput;
            const task = await recurringTaskRepo.create(input);
            return successResponse(task, 201);
        }, logger),
    );

    // POST /api/recurring-tasks/generate-all
    // (registered before the :id routes so "generate-all" is never treated
    // as an :id path parameter)
    server.route(
        'POST',
        API_ROUTES.RECURRING_TASK_GENERATE_ALL_PATTERN,
        withErrorHandling(async req => {
            const originClientId = req.headers['x-client-id'];

            const raw = await req.json<unknown>();
            const { startDate, endDate } = parseBody(GenerateInstancesSchema, raw);

            const generated = await recurringTaskService.generateAllInstances(startDate, endDate);
            for (const { recurringTaskId, tasks } of generated) {
                eventBus.publish(
                    'recurringTask:generated',
                    { tasks, recurringTaskId },
                    originClientId,
                );
            }
            return successResponse(generated);
        }, logger),
    );

    // GET /api/recurring-tasks/:id
    server.route(
        'GET',
        API_ROUTES.RECURRING_TASK_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(
                req,
                API_ROUTES.RECURRING_TASK_ROUTE_PATTERN,
                'recurring task',
            );
            const task = await recurringTaskRepo.findById(id);
            if (!task) throw notFoundError('RecurringTask', id);
            return successResponse(task);
        }, logger),
    );

    // PUT /api/recurring-tasks/:id
    server.route(
        'PUT',
        API_ROUTES.RECURRING_TASK_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(
                req,
                API_ROUTES.RECURRING_TASK_ROUTE_PATTERN,
                'recurring task',
            );
            const raw = await req.json<unknown>();
            const input = parseBody(UpdateRecurringTaskSchema, raw) as UpdateRecurringTaskInput;
            const task = await recurringTaskRepo.update(id, input);
            if (!task) throw notFoundError('RecurringTask', id);
            return successResponse(task);
        }, logger),
    );

    // POST /api/recurring-tasks/:id/generate
    server.route(
        'POST',
        API_ROUTES.RECURRING_TASK_GENERATE_PATTERN,
        withErrorHandling(async req => {
            const originClientId = req.headers['x-client-id'];
            const id = requirePathParam(
                req,
                API_ROUTES.RECURRING_TASK_GENERATE_PATTERN,
                'recurring task',
            );

            const raw = await req.json<unknown>();
            const { startDate, endDate } = parseBody(GenerateInstancesSchema, raw);

            const created = await recurringTaskService.generateInstances(id, startDate, endDate);
            eventBus.publish(
                'recurringTask:generated',
                { tasks: created, recurringTaskId: id },
                originClientId,
            );
            return successResponse(created);
        }, logger),
    );

    // GET /api/recurring-tasks/:id/stats
    // Recomputes from the template's instances on read, so the response is
    // always fresh even if a mutation hook missed a refresh.
    server.route(
        'GET',
        API_ROUTES.RECURRING_TASK_STATS_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(
                req,
                API_ROUTES.RECURRING_TASK_STATS_PATTERN,
                'recurring task',
            );
            const stats = await recurringTaskService.computeStats(id);
            return successResponse(stats);
        }, logger),
    );

    // DELETE /api/recurring-tasks/:id
    server.route(
        'DELETE',
        API_ROUTES.RECURRING_TASK_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(
                req,
                API_ROUTES.RECURRING_TASK_ROUTE_PATTERN,
                'recurring task',
            );
            const deleted = await recurringTaskRepo.delete(id);
            if (!deleted) throw notFoundError('RecurringTask', id);
            return successResponse({ success: true });
        }, logger),
    );
}
