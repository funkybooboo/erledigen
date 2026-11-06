/**
 * SomedayList API routes (USE-16, ADR-011)
 */

import type { Logger } from '@erledigen/shared';
import {
    API_ROUTES,
    type CreateSomedayListInput,
    type UpdateSomedayListInput,
    type WsServerEventMap,
} from '@erledigen/shared';
import type { SomedayListRepository } from '../adapters/data/SomedayListRepository';
import type { HttpServer } from '../adapters/http/HttpServer';
import { CreateSomedayListSchema, UpdateSomedayListSchema } from '../openapi/schemas/somedayList';
import { formatListsAsText } from '../presentation/formatters';
import type { EventBus } from '../services/EventBus';
import { notFoundError } from '../utils/errorHandler';
import {
    requirePathParam,
    respondNegotiated,
    successResponse,
    withErrorHandling,
} from '../utils/routeHelpers';
import { parseBody } from '../utils/validate';

export function registerSomedayListRoutes(
    server: HttpServer,
    somedayListRepo: SomedayListRepository,
    eventBus: EventBus<WsServerEventMap>,
    logger: Logger,
): void {
    // GET /api/someday-lists
    server.route(
        'GET',
        API_ROUTES.SOMEDAY_LISTS,
        withErrorHandling(async req => {
            const lists = await somedayListRepo.findAll();
            return respondNegotiated(req, lists, formatListsAsText);
        }, logger),
    );

    // POST /api/someday-lists
    server.route(
        'POST',
        API_ROUTES.SOMEDAY_LISTS,
        withErrorHandling(async req => {
            const originClientId = req.headers['x-client-id'];
            const raw = await req.json<unknown>();
            const input = parseBody(CreateSomedayListSchema, raw) as CreateSomedayListInput;
            const list = await somedayListRepo.create(input);
            eventBus.publish('somedayList:created', { list }, originClientId);
            return successResponse(list, 201);
        }, logger),
    );

    // GET /api/someday-lists/:id
    server.route(
        'GET',
        API_ROUTES.SOMEDAY_LIST_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(req, API_ROUTES.SOMEDAY_LIST_ROUTE_PATTERN, 'list');
            const list = await somedayListRepo.findById(id);
            if (!list) throw notFoundError('SomedayList', id);
            return successResponse(list);
        }, logger),
    );

    // PUT /api/someday-lists/:id
    server.route(
        'PUT',
        API_ROUTES.SOMEDAY_LIST_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(req, API_ROUTES.SOMEDAY_LIST_ROUTE_PATTERN, 'list');
            const originClientId = req.headers['x-client-id'];
            const raw = await req.json<unknown>();
            const input = parseBody(UpdateSomedayListSchema, raw) as UpdateSomedayListInput;
            const list = await somedayListRepo.update(id, input);
            if (!list) throw notFoundError('SomedayList', id);
            eventBus.publish('somedayList:updated', { list }, originClientId);
            return successResponse(list);
        }, logger),
    );

    // DELETE /api/someday-lists/:id
    server.route(
        'DELETE',
        API_ROUTES.SOMEDAY_LIST_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(req, API_ROUTES.SOMEDAY_LIST_ROUTE_PATTERN, 'list');
            const originClientId = req.headers['x-client-id'];
            const deleted = await somedayListRepo.delete(id);
            if (!deleted) throw notFoundError('SomedayList', id);
            eventBus.publish('somedayList:deleted', { id }, originClientId);
            return successResponse({ success: true });
        }, logger),
    );
}
