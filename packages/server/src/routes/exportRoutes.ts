/**
 * Export API routes (see ADR-008).
 *
 * GET /api/export serves the raw document -- NOT wrapped in the usual
 * { data } envelope -- because the response body is a file: the
 * canonical JSON backup or a CSV/Markdown/iCal view.
 */

import { API_ROUTES, type Logger } from '@erledigen/shared';
import type { HttpServer } from '../adapters/http/HttpServer';
import { ExportQuerySchema } from '../openapi/schemas/export';
import type { ExportService } from '../services/ExportService';
import { withErrorHandling } from '../utils/routeHelpers';
import { parseQuery } from '../utils/validate';

export function registerExportRoutes(
    server: HttpServer,
    exportService: ExportService,
    logger: Logger,
): void {
    // GET /api/export?format=json|csv|md|ics&columns=text,date
    server.route(
        'GET',
        API_ROUTES.EXPORT,
        withErrorHandling(async req => {
            const query = parseQuery(ExportQuerySchema, req.url);
            // Column subset is only meaningful for csv; the schema validated
            // the tokens, so the service never sees a bad name.
            const columns = query.columns ? query.columns.split(',') : undefined;
            const doc = await exportService.exportAs(query.format, columns);
            return {
                status: 200,
                headers: {
                    'Content-Type': `${doc.contentType}; charset=utf-8`,
                    'Content-Disposition': `attachment; filename="${doc.filename}"`,
                },
                body: doc.body,
            };
        }, logger),
    );
}
