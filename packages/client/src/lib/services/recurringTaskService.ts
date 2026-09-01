import type { HttpClient } from '@erledigen/shared';
import {
    API_ROUTES,
    type ApiResponse,
    type CreateRecurringTaskInput,
    type RecurringTask,
    type UpdateRecurringTaskInput,
} from '@erledigen/shared';

export class RecurringTaskService {
    constructor(private http: HttpClient) {}

    async getAll(): Promise<RecurringTask[]> {
        const response = await this.http.get<ApiResponse<RecurringTask[]>>(
            API_ROUTES.RECURRING_TASKS,
        );
        return response.data;
    }

    async create(input: CreateRecurringTaskInput): Promise<RecurringTask> {
        const response = await this.http.post<ApiResponse<RecurringTask>>(
            API_ROUTES.RECURRING_TASKS,
            input,
        );
        return response.data;
    }

    async update(id: string, input: UpdateRecurringTaskInput): Promise<RecurringTask> {
        const response = await this.http.put<ApiResponse<RecurringTask>>(
            API_ROUTES.RECURRING_TASK_BY_ID(id),
            input,
        );
        return response.data;
    }

    async delete(id: string): Promise<void> {
        await this.http.delete<ApiResponse<{ id: string }>>(API_ROUTES.RECURRING_TASK_BY_ID(id));
    }
}
