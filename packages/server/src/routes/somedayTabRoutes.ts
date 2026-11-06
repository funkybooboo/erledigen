/**
 * SomedayTab API routes (USE-16, ADR-011)
 */

import type { Logger } from '@erledigen/shared';
import {
    API_ROUTES,
    BadRequestError,
    type CreateSomedayTabInput,
    DEFAULT_SOMEDAY_TAB_ID,
    type UpdateSomedayTabInput,
    type WsServerEventMap,
} from '@erledigen/shared';
import type { SomedayTabRepository } from '../adapters/data/SomedayTabRepository';
import type { HttpServer } from '../adapters/http/HttpServer';
import { CreateSomedayTabSchema, UpdateSomedayTabSchema } from '../openapi/schemas/somedayTab';
import { formatTabsAsText } from '../presentation/formatters';
import type { EventBus } from '../services/EventBus';
import { notFoundError } from '../utils/errorHandler';
import {
    requirePathParam,
    respondNegotiated,
    successResponse,
    withErrorHandling,
} from '../utils/routeHelpers';
import { parseBody } from '../utils/validate';

export function registerSomedayTabRoutes(
    server: HttpServer,
    somedayTabRepo: SomedayTabRepository,
    eventBus: EventBus<WsServerEventMap>,
    logger: Logger,
): void {
    // GET /api/someday-tabs
    server.route(
        'GET',
        API_ROUTES.SOMEDAY_TABS,
        withErrorHandling(async req => {
            const tabs = await somedayTabRepo.findAll();
            return respondNegotiated(req, tabs, formatTabsAsText);
        }, logger),
    );

    // POST /api/someday-tabs
    server.route(
        'POST',
        API_ROUTES.SOMEDAY_TABS,
        withErrorHandling(async req => {
            const originClientId = req.headers['x-client-id'];
            const raw = await req.json<unknown>();
            const input = parseBody(CreateSomedayTabSchema, raw) as CreateSomedayTabInput;
            const tab = await somedayTabRepo.create(input);
            eventBus.publish('somedayTab:created', { tab }, originClientId);
            return successResponse(tab, 201);
        }, logger),
    );

    // GET /api/someday-tabs/:id
    server.route(
        'GET',
        API_ROUTES.SOMEDAY_TAB_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(req, API_ROUTES.SOMEDAY_TAB_ROUTE_PATTERN, 'tab');
            const tab = await somedayTabRepo.findById(id);
            if (!tab) throw notFoundError('SomedayTab', id);
            return successResponse(tab);
        }, logger),
    );

    // PUT /api/someday-tabs/:id
    server.route(
        'PUT',
        API_ROUTES.SOMEDAY_TAB_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(req, API_ROUTES.SOMEDAY_TAB_ROUTE_PATTERN, 'tab');
            const originClientId = req.headers['x-client-id'];
            const raw = await req.json<unknown>();
            const input = parseBody(UpdateSomedayTabSchema, raw) as UpdateSomedayTabInput;
            const tab = await somedayTabRepo.update(id, input);
            if (!tab) throw notFoundError('SomedayTab', id);
            eventBus.publish('somedayTab:updated', { tab }, originClientId);
            return successResponse(tab);
        }, logger),
    );

    // DELETE /api/someday-tabs/:id
    server.route(
        'DELETE',
        API_ROUTES.SOMEDAY_TAB_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(req, API_ROUTES.SOMEDAY_TAB_ROUTE_PATTERN, 'tab');
            // The default tab is the home of unlisted parked tasks; every
            // install owns it (USE-16, migration 013).
            if (id === DEFAULT_SOMEDAY_TAB_ID) {
                throw new BadRequestError('The default Someday tab cannot be deleted');
            }
            const originClientId = req.headers['x-client-id'];
            const deleted = await somedayTabRepo.delete(id);
            if (!deleted) throw notFoundError('SomedayTab', id);
            eventBus.publish('somedayTab:deleted', { id }, originClientId);
            return successResponse({ success: true });
        }, logger),
    );
}
