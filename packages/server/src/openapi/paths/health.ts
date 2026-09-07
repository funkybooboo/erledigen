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
