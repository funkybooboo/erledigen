import type { HttpClient, RequestOptions } from './HttpClient';
import { HttpClientError } from './HttpClient';

export class FetchHttpClient implements HttpClient {
    private baseUrl: string;
    private defaultHeaders: Record<string, string> = {};

    constructor(baseUrl: string = '') {
        this.baseUrl = baseUrl;
    }

    setDefaultHeaders(headers: Record<string, string>): void {
        this.defaultHeaders = { ...this.defaultHeaders, ...headers };
    }

    removeDefaultHeader(key: string): void {
        delete this.defaultHeaders[key];
    }

    async get<T>(url: string, options?: RequestOptions): Promise<T> {
        return this.request<T>('GET', url, undefined, options);
    }

    async post<T>(url: string, body: unknown, options?: RequestOptions): Promise<T> {
        return this.request<T>('POST', url, body, options);
    }

    async put<T>(url: string, body: unknown, options?: RequestOptions): Promise<T> {
        return this.request<T>('PUT', url, body, options);
    }

    async patch<T>(url: string, body: unknown, options?: RequestOptions): Promise<T> {
        return this.request<T>('PATCH', url, body, options);
    }

    async delete<T>(url: string, options?: RequestOptions): Promise<T> {
        return this.request<T>('DELETE', url, undefined, options);
    }

    /** GET a resource whose body is raw text (file downloads: export
     *  documents are JSON/CSV/Markdown/iCal, and only the JSON one parses).
     *  Same error behavior as the JSON methods. */
    async getText(url: string, options?: RequestOptions): Promise<string> {
        const response = await this.perform('GET', url, undefined, options);
        return response.text();
    }

    /** POST a RAW text body (import uploads, ADR-009): the document is the
     *  request body, not a JSON envelope -- the mirror of getText. */
    async postText(url: string, body: string, options?: RequestOptions): Promise<string> {
        const response = await this.perform('POST', url, body, options, 'text/plain');
        return response.text();
    }

    private async request<T>(
        method: string,
        url: string,
        body?: unknown,
        options?: RequestOptions,
    ): Promise<T> {
        const response = await this.perform(method, url, body, options);

        // Bun/Fetch API doesn't provide correct types for json(), type assertion necessary
        return response.json() as Promise<T>;
    }

    /** Shared fetch plumbing: build headers and options, execute, and map
     *  non-2xx responses to HttpClientError. `rawContentType` switches the
     *  body serialization from JSON to a raw string. */
    private async perform(
        method: string,
        url: string,
        body?: unknown,
        options?: RequestOptions,
        rawContentType?: string,
    ): Promise<Response> {
        const fullUrl: string = this.baseUrl + url;
        const headers: Record<string, string> = {
            'Content-Type': rawContentType ?? 'application/json',
            ...this.defaultHeaders,
            ...options?.headers,
        };

        // Build fetch options, only including properties when they have values
        // This satisfies exactOptionalPropertyTypes - omit properties rather than setting to undefined
        const fetchOptions: RequestInit = { method, headers };

        if (body !== undefined) {
            fetchOptions.body =
                rawContentType !== undefined ? (body as string) : JSON.stringify(body);
        }

        if (options?.timeout !== undefined) {
            fetchOptions.signal = AbortSignal.timeout(options.timeout);
        }

        const response: Response = await fetch(fullUrl, fetchOptions);

        if (!response.ok) {
            const errorBody: string = await response.text();
            throw new HttpClientError(response.status, response.statusText, errorBody);
        }

        return response;
    }
}
