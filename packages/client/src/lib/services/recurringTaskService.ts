import type { HttpClient, Task } from '@erledigen/shared';
import {
    API_ROUTES,
    type ApiResponse,
    type CreateRecurringTaskInput,
    type RecurringTask,
    type RecurringTaskStats,
    type UpdateRecurringTaskInput,
} from '@erledigen/shared';

/** Instances generated for one template by the generate-all endpoint. */
export interface GeneratedForTemplate {
    recurringTaskId: string;
    tasks: Task[];
}

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

    /** Generate missing instances for one template in a date range. */
    async generate(id: string, startDate: string, endDate: string): Promise<Task[]> {
        const response = await this.http.post<ApiResponse<Task[]>>(
            API_ROUTES.RECURRING_TASK_GENERATE(id),
            { startDate, endDate },
        );
        return response.data;
    }

    /** Streak stats for one template (recomputed server-side on read). */
    async getStats(id: string): Promise<RecurringTaskStats> {
        const response = await this.http.get<ApiResponse<RecurringTaskStats>>(
            API_ROUTES.RECURRING_TASK_STATS(id),
        );
        return response.data;
    }

    /**
     * Generate missing instances for every template in a date range.
     * Idempotent server-side; returns only templates with new instances.
     */
    async generateAll(startDate: string, endDate: string): Promise<GeneratedForTemplate[]> {
        const response = await this.http.post<ApiResponse<GeneratedForTemplate[]>>(
            API_ROUTES.RECURRING_TASKS_GENERATE_ALL,
            { startDate, endDate },
        );
        return response.data;
    }
}
