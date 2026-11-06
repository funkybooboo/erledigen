import type { HttpClient } from '@erledigen/shared';
import {
    API_ROUTES,
    type ApiResponse,
    type CreateSomedayTabInput,
    type SomedayTab,
    type UpdateSomedayTabInput,
} from '@erledigen/shared';

export class SomedayTabService {
    constructor(private http: HttpClient) {}

    async getAll(): Promise<SomedayTab[]> {
        const response = await this.http.get<ApiResponse<SomedayTab[]>>(API_ROUTES.SOMEDAY_TABS);
        return response.data;
    }

    async create(input: CreateSomedayTabInput): Promise<SomedayTab> {
        const response = await this.http.post<ApiResponse<SomedayTab>>(
            API_ROUTES.SOMEDAY_TABS,
            input,
        );
        return response.data;
    }

    async update(id: string, input: UpdateSomedayTabInput): Promise<SomedayTab> {
        const response = await this.http.put<ApiResponse<SomedayTab>>(
            API_ROUTES.SOMEDAY_TAB_BY_ID(id),
            input,
        );
        return response.data;
    }

    async delete(id: string): Promise<void> {
        await this.http.delete<ApiResponse<{ id: string }>>(API_ROUTES.SOMEDAY_TAB_BY_ID(id));
    }
}
