import { describe, expect, test } from 'bun:test';
import { NullMetricsAdapter, PrometheusMetricsAdapter } from '@erledigen/shared';
import { Container } from './container';

// Unit tests run against the ephemeral in-memory adapter so they never
// touch (or create) a database file on disk.
process.env['STORAGE_ADAPTER'] = 'memory';

describe('Container', () => {
    const container = new Container();

    test('should provide all required services', () => {
        // Verify all services can be instantiated
        expect(container.config).toBeDefined();
        expect(container.httpServer).toBeDefined();
        expect(container.taskRepository).toBeDefined();
        expect(container.logger).toBeDefined();
        expect(container.dateProvider).toBeDefined();
        expect(container.someDayGroupRepository).toBeDefined();
        expect(container.projectRepository).toBeDefined();
        expect(container.recurringTaskRepository).toBeDefined();
        expect(container.userPreferencesRepository).toBeDefined();
        expect(container.jobQueue).toBeDefined();
        expect(container.jobRunner).toBeDefined();
    });

    test('should return same instance on multiple calls (singleton)', () => {
        const config1 = container.config;
        const config2 = container.config;
        expect(config1).toBe(config2);

        const repo1 = container.someDayGroupRepository;
        const repo2 = container.someDayGroupRepository;
        expect(repo1).toBe(repo2);
    });
});

describe('Container metrics (see ADR-005)', () => {
    test('defaults to the Prometheus adapter with metrics enabled', () => {
        const metricsContainer = new Container();
        expect(metricsContainer.metricsEnabled).toBe(true);
        expect(metricsContainer.metricsAdapter).toBeInstanceOf(PrometheusMetricsAdapter);
    });

    test('returns the same adapter instance on repeat access', () => {
        const metricsContainer = new Container();
        expect(metricsContainer.metricsAdapter).toBe(metricsContainer.metricsAdapter);
    });

    test('METRICS_ENABLED=false selects the null adapter and disables the endpoint', () => {
        process.env['METRICS_ENABLED'] = 'false';
        try {
            const metricsContainer = new Container();
            expect(metricsContainer.metricsEnabled).toBe(false);
            expect(metricsContainer.metricsAdapter).toBeInstanceOf(NullMetricsAdapter);
        } finally {
            delete process.env['METRICS_ENABLED'];
        }
    });
});
