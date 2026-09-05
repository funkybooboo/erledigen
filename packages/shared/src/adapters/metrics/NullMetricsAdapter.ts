/**
 * No-op metrics adapter (see ADR-005)
 *
 * Used when METRICS_ENABLED=false and in tests: every method is a no-op,
 * `render()` returns an empty payload. Zero overhead.
 */

import type { MetricsAdapter } from './MetricsAdapter';

export class NullMetricsAdapter implements MetricsAdapter {
    incrementCounter(): void {}

    setGauge(): void {}

    incrementGauge(): void {}

    decrementGauge(): void {}

    observeHistogram(): void {}

    render(): string {
        return '';
    }
}
