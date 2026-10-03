import type { HttpClient } from '@erledigen/shared';
import {
    API_ROUTES,
    type ApiResponse,
    type CreateHolidayInput,
    type Holiday,
    type ImportIssue,
    type UpdateHolidayInput,
} from '@erledigen/shared';

/** Outcome of a holiday .ics import (mirrors the API response body). */
export interface HolidayImportResult {
    holidays: Holiday[];
    skipped: number;
    warnings: ImportIssue[];
}

export class HolidayService {
    constructor(private http: HttpClient) {}

    async getAll(): Promise<Holiday[]> {
        const response = await this.http.get<ApiResponse<Holiday[]>>(API_ROUTES.HOLIDAYS);
        return response.data;
    }

    async create(input: CreateHolidayInput): Promise<Holiday> {
        const response = await this.http.post<ApiResponse<Holiday>>(API_ROUTES.HOLIDAYS, input);
        return response.data;
    }

    async update(id: string, input: UpdateHolidayInput): Promise<Holiday> {
        const response = await this.http.put<ApiResponse<Holiday>>(
            API_ROUTES.HOLIDAY_BY_ID(id),
            input,
        );
        return response.data;
    }

    async delete(id: string): Promise<void> {
        await this.http.delete<ApiResponse<{ id: string }>>(API_ROUTES.HOLIDAY_BY_ID(id));
    }

    /** Import an .ics document (raw text -- the file-picker path). The
     *  body is the raw file, mirroring the task import convention. */
    async importIcs(source: string): Promise<HolidayImportResult> {
        const text = await this.http.postText(API_ROUTES.HOLIDAY_IMPORT, source);
        return parseImportResult(text);
    }

    /** Import a remote .ics feed; the SERVER fetches the URL (the
     *  browser would hit the feed's CORS wall). */
    async importUrl(url: string): Promise<HolidayImportResult> {
        const response = await this.http.post<ApiResponse<HolidayImportResult>>(
            API_ROUTES.HOLIDAY_IMPORT,
            { url },
        );
        return response.data;
    }
}

function parseImportResult(text: string): HolidayImportResult {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || !('data' in parsed)) {
        throw new Error('Holiday import failed: unexpected server response');
    }
    return (parsed as { data: HolidayImportResult }).data;
}
