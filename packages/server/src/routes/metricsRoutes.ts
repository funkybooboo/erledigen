/**
 * Prometheus metrics endpoint (see ADR-005)
 *
 * Renders the collected metrics in Prometheus text exposition format.
 * Application gauges (uptime, task count, WebSocket connections, database
 * size) are set at scrape time so they never go stale; request and job
 * metrics are recorded live at their source.
 *
 * Registered only when metrics are enabled (METRICS_ENABLED=false removes
 * the endpoint entirely -- 404 -- instead of serving an empty payload).
 */

import type { MetricsAdapter } from '@erledigen/shared';
import {
    API_ROUTES,
    DB_SIZE_BYTES,
    TASKS_TOTAL,
    UPTIME_SECONDS,
    WS_CONNECTIONS_ACTIVE,
} from '@erledigen/shared';
import type { HttpServer } from '../adapters/http/HttpServer';
import type { ServerStatusDeps } from './healthRoutes';

export function registerMetricsRoutes(
    server: HttpServer,
    metrics: MetricsAdapter,
    deps: ServerStatusDeps,
): void {
    server.route('GET', API_ROUTES.METRICS, async () => {
        // Scrape-time gauges: point-in-time values rather than counters.
        metrics.setGauge(UPTIME_SECONDS, {}, Math.max(0, (Date.now() - deps.startedAt) / 1000));
        metrics.setGauge(TASKS_TOTAL, {}, await deps.taskRepository.count());
        metrics.setGauge(WS_CONNECTIONS_ACTIVE, {}, deps.connectionManager.size());
        if (deps.storageAdapter === 'sqlite') {
            const sqlite = deps.sqliteConnection;
            const sizeBytes = sqlite ? sqlite.sizeBytes() : null;
            if (sizeBytes !== null) metrics.setGauge(DB_SIZE_BYTES, {}, sizeBytes);
        }

        return {
            status: 200,
            headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
            body: metrics.render(),
        };
    });
}
