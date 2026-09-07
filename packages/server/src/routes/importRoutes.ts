/**
 * Import API routes (ADR-009).
 *
 * POST /api/import?format=json|csv|ics|todoist-csv|things-json reads the
 * RAW source document as the request body (the mirror of GET /api/export:
 * what you download is what you can upload), validates it, and writes.
 * The RESPONSE is the standard { data: ImportResult } envelope: only the
 * export endpoint serves raw documents (ADR-008); an import returns a
 * summary.
 *
 * format=json RESTORES: the route broadcasts 'data:restored' so every
 * connected client refetches its world (per-row events cannot describe a
 * wholesale replace). Additive imports broadcast per-task
 * task:created/task:deleted events, consistent with the realtime model.
 */

import {
    API_ROUTES,
    type CsvColumnMapping,
    CsvImportAdapter,
    type CsvImportField,
    type Logger,
    type WsServerEventMap,
} from '@erledigen/shared';
import type { HttpServer } from '../adapters/http/HttpServer';
import { ImportQuerySchema } from '../openapi/schemas/import';
import type { EventBus } from '../services/EventBus';
import type { ImportService } from '../services/ImportService';
import { withErrorHandling } from '../utils/routeHelpers';
import { parseQuery } from '../utils/validate';

/** Parse `field:columnIndex,field:columnIndex` into a column mapping of
 *  header NAMES (the adapter maps by name). Column indexes survive
 *  header cells containing commas because the header row is parsed
 *  RFC 4180-style, not naively split. */
function parseMappingParam(raw: string, header: readonly string[]): CsvColumnMapping {
    const mapping: CsvColumnMapping = {};
    for (const pair of raw.split(',')) {
        const separator = pair.indexOf(':');
        if (separator === -1) continue;
        const field = pair.slice(0, separator) as CsvImportField;
        const index = Number.parseInt(pair.slice(separator + 1), 10);
        mapping[field] = header[index] ?? null;
    }
    return mapping;
}

export function registerImportRoutes(
    server: HttpServer,
    importService: ImportService,
    eventBus: EventBus<WsServerEventMap>,
    logger: Logger,
): void {
    // POST /api/import?format=...&mapping=field:idx,...
    server.route(
        'POST',
        API_ROUTES.IMPORT,
        withErrorHandling(async req => {
            const query = parseQuery(ImportQuerySchema, req.url);
            const source = await req.text();
            const originClientId = req.headers['x-client-id'];

            if (query.format === 'json') {
                const result = await importService.restore(source);
                eventBus.publish('data:restored', { restored: result.restored }, originClientId);
                return { status: 200, headers: {}, body: { data: result } };
            }

            // The query validated the mapping tokens (field:columnIndex);
            // CsvImportAdapter maps by column NAME, so translate indexes
            // through the parsed header row.
            const header = CsvImportAdapter.readHeader(source);
            const mapping = query.mapping ? parseMappingParam(query.mapping, header) : undefined;

            const { result, createdTasks, canceledIds } = await importService.importTasks(
                query.format,
                source,
                mapping,
            );
            for (const task of createdTasks) {
                eventBus.publish('task:created', { task }, originClientId);
            }
            for (const id of canceledIds) {
                eventBus.publish('task:deleted', { id }, originClientId);
            }
            return { status: 200, headers: {}, body: { data: result } };
        }, logger),
    );
}
