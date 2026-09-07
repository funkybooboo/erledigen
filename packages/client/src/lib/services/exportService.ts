import type { DateProvider, ExportFormat, HttpClient } from '@erledigen/shared';
import { API_ROUTES, EXPORT_FORMAT_META } from '@erledigen/shared';

export interface ExportDownload {
    /** Raw document text. */
    text: string;
    /** Media type for the Blob. */
    contentType: string;
    /** Download filename. */
    filename: string;
}

/**
 * Downloads export documents from GET /api/export.
 *
 * The body arrives as raw text (only the JSON format parses), so this uses
 * HttpClient.getText rather than the JSON methods; the browser download is
 * then created from a Blob so the same code works for split-origin (dev)
 * and reverse-proxied single-origin (prod) deployments.
 */
export class ExportService {
    constructor(
        private readonly http: HttpClient,
        private readonly dateProvider: DateProvider,
    ) {}

    async export(format: ExportFormat): Promise<ExportDownload> {
        const text = await this.http.getText(`${API_ROUTES.EXPORT}?format=${format}`);
        const meta = EXPORT_FORMAT_META[format];
        return {
            text,
            contentType: meta.contentType,
            filename: `erledigen-export-${this.dateProvider.today()}.${meta.extension}`,
        };
    }
}
