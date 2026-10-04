/**
 * DayNote API routes (v0.10.0): the paper calendar's margin.
 *
 * Plain upsert/delete-by-date persistence talks to the repository
 * directly -- there is no behavior beyond storage, so no service layer
 * (the HolidayService precedent only exists for its .ics parsing).
 */

import type { Logger } from '@erledigen/shared';
import {
    API_ROUTES,
    BadRequestError,
    type UpsertDayNoteInput,
    type WsServerEventMap,
} from '@erledigen/shared';
import type { DayNoteRepository } from '../adapters/data/DayNoteRepository';
import type { HttpServer } from '../adapters/http/HttpServer';
import type { HttpRequest } from '../adapters/http/types';
import { dayNoteDateParams, UpsertDayNoteSchema } from '../openapi/schemas/dayNote';
import { formatDayNotesAsText } from '../presentation/formatters';
import type { EventBus } from '../services/EventBus';
import { notFoundError } from '../utils/errorHandler';
import {
    requirePathParam,
    respondNegotiated,
    successResponse,
    withErrorHandling,
} from '../utils/routeHelpers';
import { parseBody } from '../utils/validate';

export function registerDayNoteRoutes(
    server: HttpServer,
    dayNoteRepo: DayNoteRepository,
    eventBus: EventBus<WsServerEventMap>,
    logger: Logger,
): void {
    // GET /api/day-notes -- every note, in date order
    server.route(
        'GET',
        API_ROUTES.DAY_NOTES,
        withErrorHandling(async req => {
            const dayNotes = await dayNoteRepo.findAll();
            return respondNegotiated(req, dayNotes, formatDayNotesAsText);
        }, logger),
    );

    // GET /api/day-notes/:date
    server.route(
        'GET',
        API_ROUTES.DAY_NOTE_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const date = requireDayNoteDate(req);
            const dayNote = await dayNoteRepo.findByDate(date);
            if (!dayNote) throw notFoundError('Day note', date);
            return successResponse(dayNote);
        }, logger),
    );

    // PUT /api/day-notes/:date -- upsert
    server.route(
        'PUT',
        API_ROUTES.DAY_NOTE_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const date = requireDayNoteDate(req);
            const originClientId = req.headers['x-client-id'];
            const raw = await req.json<unknown>();
            const input = parseBody(UpsertDayNoteSchema, raw) as UpsertDayNoteInput;
            const { dayNote, created } = await dayNoteRepo.upsert(date, input);
            eventBus.publish(
                created ? 'dayNote:created' : 'dayNote:updated',
                { dayNote },
                originClientId,
            );
            return successResponse(dayNote);
        }, logger),
    );

    // DELETE /api/day-notes/:date
    server.route(
        'DELETE',
        API_ROUTES.DAY_NOTE_ROUTE_PATTERN,
        withErrorHandling(async req => {
            const date = requireDayNoteDate(req);
            const originClientId = req.headers['x-client-id'];
            const deleted = await dayNoteRepo.delete(date);
            if (!deleted) throw notFoundError('Day note', date);
            eventBus.publish('dayNote:deleted', { date }, originClientId);
            return successResponse({ success: true });
        }, logger),
    );
}

/** The :date path param, validated against the shared yyyy-MM-dd shape
 *  (day notes are addressed by date, never by internal id). A malformed
 *  date is a bad request, not a missing row. */
function requireDayNoteDate(req: HttpRequest): string {
    const date = requirePathParam(req, API_ROUTES.DAY_NOTE_ROUTE_PATTERN, 'date');
    if (!dayNoteDateParams.safeParse({ date }).success) {
        throw new BadRequestError('Date must be a yyyy-MM-dd string');
    }
    return date;
}
