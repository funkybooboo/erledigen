import type { CsvColumnMapping, HttpClient, ImportFormat, ImportResult } from '@erledigen/shared';
import { API_ROUTES } from '@erledigen/shared';

/** Generic CSV import options: the user's column mapping (Erledigen
 *  field -> source header NAME, produced by the mapping UI) plus the
 *  file's header row, so the mapping can travel as field:columnIndex
 *  pairs -- index-based mapping survives header names containing
 *  commas or colons. */
export interface CsvImportOptions {
    mapping: CsvColumnMapping;
    header: readonly string[];
}

/**
 * Uploads import documents to POST /api/import (ADR-009).
 *
 * The body is the raw file text (the mirror of the export download);
 * the response is the { data: ImportResult } envelope.
 */
export class ImportService {
    constructor(private readonly http: HttpClient) {}

    async importDocument(
        format: ImportFormat,
        source: string,
        csv?: CsvImportOptions,
    ): Promise<ImportResult> {
        const params = new URLSearchParams({ format });
        if (csv !== undefined) {
            const pairs = Object.entries(csv.mapping)
                .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
                .map(([field, name]) => {
                    const index = csv.header.indexOf(name);
                    return index === -1 ? null : `${field}:${index}`;
                })
                .filter(pair => pair !== null);
            if (pairs.length > 0) params.set('mapping', pairs.join(','));
        }
        const text = await this.http.postText(`${API_ROUTES.IMPORT}?${params.toString()}`, source);
        const parsed: unknown = JSON.parse(text);
        if (typeof parsed !== 'object' || parsed === null || !('data' in parsed)) {
            throw new Error('Import failed: unexpected server response');
        }
        return (parsed as { data: ImportResult }).data;
    }
}
