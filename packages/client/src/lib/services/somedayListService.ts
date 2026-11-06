import type { HttpClient } from '@erledigen/shared';
import {
    API_ROUTES,
    type ApiResponse,
    type CreateSomedayListInput,
    type SomedayList,
    type UpdateSomedayListInput,
} from '@erledigen/shared';

export class SomedayListService {
    constructor(private http: HttpClient) {}

    async getAll(): Promise<SomedayList[]> {
        const response = await this.http.get<ApiResponse<SomedayList[]>>(API_ROUTES.SOMEDAY_LISTS);
        return response.data;
    }

    async create(input: CreateSomedayListInput): Promise<SomedayList> {
        const response = await this.http.post<ApiResponse<SomedayList>>(
            API_ROUTES.SOMEDAY_LISTS,
            input,
        );
        return response.data;
    }

    async update(id: string, input: UpdateSomedayListInput): Promise<SomedayList> {
        const response = await this.http.put<ApiResponse<SomedayList>>(
            API_ROUTES.SOMEDAY_LIST_BY_ID(id),
            input,
        );
        return response.data;
    }

    async delete(id: string): Promise<void> {
        await this.http.delete<ApiResponse<{ id: string }>>(API_ROUTES.SOMEDAY_LIST_BY_ID(id));
    }
}
