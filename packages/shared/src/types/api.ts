/**
 * API Request and Response types
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
    data: T;
    message?: string;
}

export interface ErrorResponseBody {
    error: string;
    code: string;
    details?: unknown;
}
