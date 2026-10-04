import type { ApiResponse, DayNote, HttpClient } from '@erledigen/shared';
import { API_ROUTES } from '@erledigen/shared';

/** Client service for day notes (v0.10.0): upsert/delete addressed BY
 *  DATE -- the day's note has no addressable id from the client's
 *  perspective (the server keeps one for the export snapshot). */
export class DayNoteService {
    constructor(private http: HttpClient) {}

    async getAll(): Promise<DayNote[]> {
        const response = await this.http.get<ApiResponse<DayNote[]>>(API_ROUTES.DAY_NOTES);
        return response.data;
    }

    async upsert(date: string, notes: string): Promise<DayNote> {
        const response = await this.http.put<ApiResponse<DayNote>>(
            API_ROUTES.DAY_NOTE_BY_DATE(date),
            { notes },
        );
        return response.data;
    }

    async delete(date: string): Promise<void> {
        await this.http.delete<ApiResponse<{ success: boolean }>>(
            API_ROUTES.DAY_NOTE_BY_DATE(date),
        );
    }
}
