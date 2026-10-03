/**
 * Holiday API routes (v0.9.0).
 *
 * Plain CRUD talks to the repository directly; only the .ics import
 * goes through HolidayService (parsing + duplicate suppression are
 * behavior beyond persistence -- see the service doc comment).
 */

import type { Logger } from '@erledigen/shared';
import {
    API_ROUTES,
    type CreateHolidayInput,
    type UpdateHolidayInput,
    type WsServerEventMap,
} from '@erledigen/shared';
import type { HolidayRepository } from '../adapters/data/HolidayRepository';
import type { HttpServer } from '../adapters/http/HttpServer';
import {
    CreateHolidaySchema,
    HolidayImportUrlSchema,
    UpdateHolidaySchema,
} from '../openapi/schemas/holiday';
import { formatHolidaysAsText } from '../presentation/formatters';
import type { EventBus } from '../services/EventBus';
import type { HolidayService } from '../services/HolidayService';
import { notFoundError } from '../utils/errorHandler';
import {
    requirePathParam,
    respondNegotiated,
    successResponse,
    withErrorHandling,
} from '../utils/routeHelpers';
import { parseBody } from '../utils/validate';

export function registerHolidayRoutes(
    server: HttpServer,
    holidayRepo: HolidayRepository,
    holidayService: HolidayService,
    eventBus: EventBus<WsServerEventMap>,
    logger: Logger,
): void {
    // Literal before :id -- /api/holidays/import must not parse as an id
    // (see architecture.md route-order note).

    // POST /api/holidays/import (raw .ics text, or JSON { url })
    server.route(
        'POST',
        API_ROUTES.HOLIDAY_IMPORT,
        withErrorHandling(async req => {
            const originClientId = req.headers['x-client-id'];
            const contentType = req.headers['content-type'] ?? '';

            // JSON body selects the remote-feed mode (the server fetches
            // so the browser never hits the feed's CORS wall); anything
            // else is the raw .ics document itself.
            const outcome = contentType.includes('application/json')
                ? await holidayService.importFromUrl(
                      parseBody(HolidayImportUrlSchema, await req.json<unknown>()).url,
                  )
                : await holidayService.importFromIcs(await req.text());

            if (outcome.holidays.length > 0) {
                eventBus.publish(
                    'holidays:imported',
                    { holidays: outcome.holidays },
                    originClientId,
                );
            }
            return successResponse({
                holidays: outcome.holidays,
                skipped: outcome.skipped,
                warnings: outcome.warnings,
            });
        }, logger),
    );

    // GET /api/holidays
    server.route(
        'GET',
        API_ROUTES.HOLIDAYS,
        withErrorHandling(async req => {
            const holidays = await holidayRepo.findAll();
            return respondNegotiated(req, holidays, formatHolidaysAsText);
        }, logger),
    );

    // POST /api/holidays
    server.route(
        'POST',
        API_ROUTES.HOLIDAYS,
        withErrorHandling(async req => {
            const originClientId = req.headers['x-client-id'];
            const raw = await req.json<unknown>();
            const input = parseBody(CreateHolidaySchema, raw) as CreateHolidayInput;
            const holiday = await holidayRepo.create(input);
            eventBus.publish('holiday:created', { holiday }, originClientId);
            return successResponse(holiday, 201);
        }, logger),
    );

    // GET /api/holidays/:id
    server.route(
        'GET',
        API_ROUTES.HOLIDAY_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(req, API_ROUTES.HOLIDAY_ROUTE_PATTERN, 'id');
            const holiday = await holidayRepo.findById(id);
            if (!holiday) throw notFoundError('Holiday', id);
            return successResponse(holiday);
        }, logger),
    );

    // PUT /api/holidays/:id
    server.route(
        'PUT',
        API_ROUTES.HOLIDAY_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(req, API_ROUTES.HOLIDAY_ROUTE_PATTERN, 'id');
            const originClientId = req.headers['x-client-id'];
            const raw = await req.json<unknown>();
            const input = parseBody(UpdateHolidaySchema, raw) as UpdateHolidayInput;
            const holiday = await holidayRepo.update(id, input);
            if (!holiday) throw notFoundError('Holiday', id);
            eventBus.publish('holiday:updated', { holiday }, originClientId);
            return successResponse(holiday);
        }, logger),
    );

    // DELETE /api/holidays/:id
    server.route(
        'DELETE',
        API_ROUTES.HOLIDAY_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const id = requirePathParam(req, API_ROUTES.HOLIDAY_ROUTE_PATTERN, 'id');
            const originClientId = req.headers['x-client-id'];
            const deleted = await holidayRepo.delete(id);
            if (!deleted) throw notFoundError('Holiday', id);
            eventBus.publish('holiday:deleted', { id }, originClientId);
            return successResponse({ success: true });
        }, logger),
    );
}
