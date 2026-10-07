/**
 * OpenAPI path registrations: root, health, and metrics.
 *
 * Importing this module registers these paths with the registry
 * (side-effect module; openapi/spec.ts imports it for that).
 */

import { z } from 'zod';
import { registry } from '../registry';

// -- Root -----------------------------------------------------------------------

registry.registerPath({
    method: 'get',
    path: '/',
    summary: 'Root greeting',
    operationId: 'getRoot',
    responses: {
        200: {
            description:
                'Plain-text hello (dev convenience; the prod proxy serves the client at /)',
            content: { 'text/plain': { schema: z.string() } },
        },
    },
});

// -- Health ---------------------------------------------------------------------

registry.registerPath({
    method: 'get',
    path: '/api/health',
    summary: 'Health check',
    operationId: 'getHealth',
    responses: {
        200: {
            description: 'Server is healthy',
            content: {
                'application/json': {
                    schema: z.object({ data: z.object({ status: z.enum(['ok']) }) }),
                },
            },
        },
    },
});

// -- Orchestrator probes (ADR-018) ------------------------------------------------

registry.registerPath({
    method: 'get',
    path: '/healthz',
    summary: 'Liveness probe',
    description:
        'The process is alive. Deliberately performs no dependency checks -- ' +
        'a database outage must not get the container restarted. Orchestration ' +
        'convention (Kubernetes liveness/readiness); the human-oriented health ' +
        'report lives on /api/health.',
    operationId: 'getHealthz',
    responses: {
        200: {
            description: 'Process is alive',
            content: {
                'application/json': {
                    schema: z.object({ data: z.object({ status: z.enum(['ok']) }) }),
                },
            },
        },
    },
});

registry.registerPath({
    method: 'get',
    path: '/readyz',
    summary: 'Readiness probe',
    description:
        'Dependencies reachable (a SQLite SELECT 1 catches a detached or ' +
        'corrupted database file). 503 pauses traffic without restarting the ' +
        'process.',
    operationId: 'getReadyz',
    responses: {
        200: {
            description: 'Ready to serve',
            content: {
                'application/json': {
                    schema: z.object({ data: z.object({ status: z.enum(['ready']) }) }),
                },
            },
        },
        503: {
            description: 'A dependency is unreachable',
            content: {
                'application/json': {
                    schema: z.object({
                        error: z.object({ code: z.string(), message: z.string() }),
                    }),
                },
            },
        },
    },
});

// -- Metrics --------------------------------------------------------------------

registry.registerPath({
    method: 'get',
    path: '/api/metrics',
    summary: 'Prometheus metrics',
    operationId: 'getMetrics',
    responses: {
        200: {
            description:
                'Metrics in Prometheus text exposition format (HTTP latency/requests, job metrics, application gauges). The endpoint is removed entirely when METRICS_ENABLED=false.',
            content: { 'text/plain': { schema: z.string() } },
        },
    },
});
