/**
 * Metrics adapter interface (see ADR-005)
 *
 * Runtime-agnostic metrics collection following the adapter pattern:
 * `PrometheusMetricsAdapter` is the default implementation (in-memory,
 * renders Prometheus text format); `NullMetricsAdapter` is the zero-cost
 * no-op for tests and `METRICS_ENABLED=false`. Future implementations
 * (OpenTelemetry, StatsD) swap in without touching call sites.
 *
 * Metric names use the `erledigen_` prefix (see ADR-007) and are defined
 * once in metricNames.ts -- never hand-write metric name strings.
 */

/**
 * Metrics adapter interface
 */
export interface MetricsAdapter {
    /**
     * Increment a monotonic counter
     * @param name - Metric name (from metricNames.ts)
     * @param labels - Label set for this series
     * @param value - Amount to add (default: 1)
     */
    incrementCounter(name: string, labels: Record<string, string>, value?: number): void;

    /**
     * Set a gauge to an absolute value
     * @param name - Metric name (from metricNames.ts)
     * @param labels - Label set for this series
     * @param value - The value to set
     */
    setGauge(name: string, labels: Record<string, string>, value: number): void;

    /**
     * Increment a gauge by a delta
     * @param name - Metric name (from metricNames.ts)
     * @param labels - Label set for this series
     * @param value - Amount to add (default: 1)
     */
    incrementGauge(name: string, labels: Record<string, string>, value?: number): void;

    /**
     * Decrement a gauge by a delta
     * @param name - Metric name (from metricNames.ts)
     * @param labels - Label set for this series
     * @param value - Amount to subtract (default: 1)
     */
    decrementGauge(name: string, labels: Record<string, string>, value?: number): void;

    /**
     * Record an observation in a histogram
     * @param name - Metric name (from metricNames.ts)
     * @param labels - Label set for this series
     * @param value - Observed value (e.g. seconds for duration histograms)
     */
    observeHistogram(name: string, labels: Record<string, string>, value: number): void;

    /**
     * Render all collected metrics as a text exposition payload
     * @returns The rendered payload (Prometheus text format for the
     *   Prometheus adapter; empty string for the null adapter)
     */
    render(): string;
}
