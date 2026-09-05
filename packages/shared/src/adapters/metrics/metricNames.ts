/**
 * Metric name catalog (see ADR-005; prefix per ADR-007)
 *
 * Single source of truth for every metric name, help line, and histogram
 * bucket set. Call sites import these constants -- metric names are never
 * hand-written strings.
 */

/** Namespace prefix for all Erledigen metrics (see ADR-007). */
export const METRIC_PREFIX = 'erledigen_';

// -- HTTP request metrics ----------------------------------------------------

export const HTTP_REQUESTS_TOTAL = `${METRIC_PREFIX}http_requests_total`;
export const HTTP_REQUEST_DURATION_SECONDS = `${METRIC_PREFIX}http_request_duration_seconds`;
export const HTTP_REQUESTS_ACTIVE = `${METRIC_PREFIX}http_requests_active`;

/** Histogram buckets (seconds) for request duration. */
export const HTTP_DURATION_BUCKETS = [
    0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
] as const;

// -- Background job metrics ---------------------------------------------------

export const JOBS_TOTAL = `${METRIC_PREFIX}jobs_total`;
export const JOB_DURATION_SECONDS = `${METRIC_PREFIX}job_duration_seconds`;
export const JOBS_PENDING = `${METRIC_PREFIX}jobs_pending`;
export const JOBS_RUNNING = `${METRIC_PREFIX}jobs_running`;

/** Histogram buckets (seconds) for job execution duration. */
export const JOB_DURATION_BUCKETS = [0.1, 0.5, 1, 5, 10, 30, 60, 300] as const;

// -- Application metrics -------------------------------------------------------

export const DB_SIZE_BYTES = `${METRIC_PREFIX}db_size_bytes`;
export const TASKS_TOTAL = `${METRIC_PREFIX}tasks_total`;
export const WS_CONNECTIONS_ACTIVE = `${METRIC_PREFIX}ws_connections_active`;
export const UPTIME_SECONDS = `${METRIC_PREFIX}uptime_seconds`;
export const BUILD_INFO = `${METRIC_PREFIX}build_info`;

/** HELP lines for render(), keyed by metric name. */
export const METRIC_HELP: Record<string, string> = {
    [HTTP_REQUESTS_TOTAL]: 'Total HTTP requests processed',
    [HTTP_REQUEST_DURATION_SECONDS]: 'Request duration in seconds',
    [HTTP_REQUESTS_ACTIVE]: 'Currently in-flight HTTP requests',
    [JOBS_TOTAL]: 'Total background jobs processed',
    [JOB_DURATION_SECONDS]: 'Background job execution duration in seconds',
    [JOBS_PENDING]: 'Currently pending background jobs',
    [JOBS_RUNNING]: 'Currently running background jobs',
    [DB_SIZE_BYTES]: 'SQLite database file size in bytes',
    [TASKS_TOTAL]: 'Total tasks in the database',
    [WS_CONNECTIONS_ACTIVE]: 'Active WebSocket connections',
    [UPTIME_SECONDS]: 'Server uptime in seconds',
    [BUILD_INFO]: 'Build version (constant 1; the label carries the version)',
};

/** Bucket sets per histogram name. Names absent here get the HTTP buckets. */
export const HISTOGRAM_BUCKETS: Record<string, readonly number[]> = {
    [HTTP_REQUEST_DURATION_SECONDS]: HTTP_DURATION_BUCKETS,
    [JOB_DURATION_SECONDS]: JOB_DURATION_BUCKETS,
};
