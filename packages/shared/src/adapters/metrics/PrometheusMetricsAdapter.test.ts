import { describe, expect, it } from 'bun:test';
import type { MetricsAdapter } from './MetricsAdapter';
import {
    HTTP_REQUEST_DURATION_SECONDS,
    HTTP_REQUESTS_ACTIVE,
    HTTP_REQUESTS_TOTAL,
    JOB_DURATION_SECONDS,
    JOBS_TOTAL,
    UPTIME_SECONDS,
} from './metricNames';
import { NullMetricsAdapter } from './NullMetricsAdapter';
import { PrometheusMetricsAdapter } from './PrometheusMetricsAdapter';

describe('PrometheusMetricsAdapter', () => {
    it('renders a counter with HELP and TYPE lines', () => {
        const metrics = new PrometheusMetricsAdapter();
        metrics.incrementCounter(HTTP_REQUESTS_TOTAL, { method: 'GET', path: '/api/health' });

        const out = metrics.render();
        expect(out).toContain('# HELP erledigen_http_requests_total Total HTTP requests processed');
        expect(out).toContain('# TYPE erledigen_http_requests_total counter');
        expect(out).toContain('erledigen_http_requests_total{method="GET",path="/api/health"} 1');
    });

    it('increments the same series with a custom value', () => {
        const metrics = new PrometheusMetricsAdapter();
        metrics.incrementCounter(JOBS_TOTAL, { type: 'rollover', status: 'completed' });
        metrics.incrementCounter(JOBS_TOTAL, { type: 'rollover', status: 'completed' }, 4);

        expect(metrics.render()).toContain(
            'erledigen_jobs_total{status="completed",type="rollover"} 5',
        );
    });

    it('keeps different label sets as separate series', () => {
        const metrics = new PrometheusMetricsAdapter();
        metrics.incrementCounter(HTTP_REQUESTS_TOTAL, { method: 'GET', path: '/api/tasks' });
        metrics.incrementCounter(HTTP_REQUESTS_TOTAL, { method: 'POST', path: '/api/tasks' });

        const out = metrics.render();
        expect(out).toContain('erledigen_http_requests_total{method="GET",path="/api/tasks"} 1');
        expect(out).toContain('erledigen_http_requests_total{method="POST",path="/api/tasks"} 1');
    });

    it('renders gauges set absolutely and by delta', () => {
        const metrics = new PrometheusMetricsAdapter();
        metrics.setGauge(UPTIME_SECONDS, {}, 86400);
        metrics.incrementGauge(HTTP_REQUESTS_ACTIVE, { method: 'GET' });
        metrics.incrementGauge(HTTP_REQUESTS_ACTIVE, { method: 'GET' });
        metrics.decrementGauge(HTTP_REQUESTS_ACTIVE, { method: 'GET' });

        const out = metrics.render();
        expect(out).toContain('erledigen_uptime_seconds 86400');
        expect(out).toContain('erledigen_http_requests_active{method="GET"} 1');
    });

    it('renders a histogram with cumulative buckets, sum, and count', () => {
        const metrics = new PrometheusMetricsAdapter();
        metrics.observeHistogram(HTTP_REQUEST_DURATION_SECONDS, { method: 'GET' }, 0.003);
        metrics.observeHistogram(HTTP_REQUEST_DURATION_SECONDS, { method: 'GET' }, 0.02);

        const out = metrics.render();
        // 0.003 <= 0.005 bucket, 0.02 lands in the 0.025 bucket.
        expect(out).toContain(
            'erledigen_http_request_duration_seconds_bucket{le="0.005",method="GET"} 1',
        );
        expect(out).toContain(
            'erledigen_http_request_duration_seconds_bucket{le="0.01",method="GET"} 1',
        );
        expect(out).toContain(
            'erledigen_http_request_duration_seconds_bucket{le="0.025",method="GET"} 2',
        );
        expect(out).toContain(
            'erledigen_http_request_duration_seconds_bucket{le="+Inf",method="GET"} 2',
        );
        expect(out).toContain('erledigen_http_request_duration_seconds_sum{method="GET"} 0.023');
        expect(out).toContain('erledigen_http_request_duration_seconds_count{method="GET"} 2');
    });

    it('uses the job bucket set for job durations', () => {
        const metrics = new PrometheusMetricsAdapter();
        metrics.observeHistogram(JOB_DURATION_SECONDS, { type: 'rollover' }, 45);

        const out = metrics.render();
        // 45s falls in the 60s bucket; the HTTP set (max le 10) would not
        // have any finite bucket holding it.
        expect(out).toContain('erledigen_job_duration_seconds_bucket{le="60",type="rollover"} 1');
        expect(out).toContain('erledigen_job_duration_seconds_count{type="rollover"} 1');
    });

    it('escapes special characters in label values', () => {
        const metrics = new PrometheusMetricsAdapter();
        metrics.incrementCounter(HTTP_REQUESTS_TOTAL, { method: 'GET', path: 'a"b\\c' });

        expect(metrics.render()).toContain('path="a\\"b\\\\c"');
    });

    it('records build_info with the version label at construction', () => {
        const metrics = new PrometheusMetricsAdapter('1.2.3');
        expect(metrics.render()).toContain('erledigen_build_info{version="1.2.3"} 1');
    });

    it('renders deterministically (sorted names and label sets)', () => {
        const metrics = new PrometheusMetricsAdapter();
        metrics.incrementCounter(JOBS_TOTAL, { type: 'purge-deleted', status: 'completed' });
        metrics.incrementCounter(HTTP_REQUESTS_TOTAL, { method: 'GET', path: '/api/tasks' });
        metrics.incrementCounter(JOBS_TOTAL, { type: 'rollover', status: 'completed' });

        const first = metrics.render();
        const second = metrics.render();
        expect(first).toBe(second);

        // erledigen_http_* sorts before erledigen_jobs_*, and within a
        // metric the series sort by their label set.
        const lines = first.split('\n');
        const jobsIdx = lines.findIndex(l => l.startsWith('erledigen_jobs_total'));
        const httpIdx = lines.findIndex(l => l.startsWith('erledigen_http_requests_total{'));
        expect(httpIdx).toBeLessThan(jobsIdx);
    });

    it('renders an empty payload when nothing was recorded', () => {
        const metrics = new PrometheusMetricsAdapter();
        expect(metrics.render()).toBe('');
    });
});

describe('NullMetricsAdapter', () => {
    it('accepts every call as a no-op and renders nothing', () => {
        // Call through the interface so the no-op signatures stay honest:
        // every method must accept exactly what MetricsAdapter promises.
        const metrics: MetricsAdapter = new NullMetricsAdapter();
        metrics.incrementCounter(HTTP_REQUESTS_TOTAL, { method: 'GET', path: '/' });
        metrics.setGauge(UPTIME_SECONDS, {}, 1);
        metrics.observeHistogram(HTTP_REQUEST_DURATION_SECONDS, {}, 0.1);

        expect(metrics.render()).toBe('');
    });
});
