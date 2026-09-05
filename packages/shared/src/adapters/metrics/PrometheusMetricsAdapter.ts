/**
 * Prometheus-compatible metrics adapter (see ADR-005)
 *
 * In-memory counters, gauges, and histograms rendering the Prometheus text
 * exposition format on demand. Single-process, synchronous Bun runtime --
 * plain maps with no locking are correct here. Counters are lost on restart
 * (Prometheus's rate()/increase() handle the reset transparently).
 *
 * Rendering is deterministic: metric names sort alphabetically and label
 * sets sort by their serialized label string, so scrapes are stable and
 * tests can assert exact lines.
 */

import type { MetricsAdapter } from './MetricsAdapter';
import { BUILD_INFO, HISTOGRAM_BUCKETS, HTTP_DURATION_BUCKETS, METRIC_HELP } from './metricNames';

type Labels = Record<string, string>;

/** Escapes a label value per the Prometheus text format. */
function escapeLabelValue(value: string): string {
    // Regex replaces, not replaceAll: the shared package's TS lib target
    // predates es2021's replaceAll.
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/** Deterministic, unique key for a label set: sorted "k\0v" pairs joined by \1. */
function labelKey(labels: Labels): string {
    const keys = Object.keys(labels).sort();
    return keys.map(key => `${key}\u0000${labels[key] ?? ''}`).join('\u0001');
}

/** Rendered label block, e.g. {method="GET",path="/api/tasks"}. */
function labelBlock(labels: Labels): string {
    const keys = Object.keys(labels).sort();
    if (keys.length === 0) return '';
    const parts = keys.map(key => `${key}="${escapeLabelValue(labels[key] ?? '')}"`);
    return `{${parts.join(',')}}`;
}

interface HistogramSeries {
    /** Upper bounds of the buckets this series observes with. */
    bounds: readonly number[];
    /** Per-bucket counts, NOT cumulative (render makes them cumulative). */
    counts: number[];
    sum: number;
    count: number;
}

interface NameEntry {
    kind: 'counter' | 'gauge';
    /** Series label sets, keyed by labelKey for deterministic rendering. */
    series: Map<string, Labels>;
}

export class PrometheusMetricsAdapter implements MetricsAdapter {
    private counters = new Map<string, number>();
    private gauges = new Map<string, number>();
    private names = new Map<string, NameEntry>();
    private histograms = new Map<
        string,
        Map<string, { labels: Labels; series: HistogramSeries }>
    >();

    constructor(version?: string) {
        if (version !== undefined) {
            // Constant 1; the label carries the version (see ADR-005).
            this.setGauge(BUILD_INFO, { version }, 1);
        }
    }

    incrementCounter(name: string, labels: Labels, value = 1): void {
        this.trackName(name, labels, 'counter');
        const key = this.seriesKey(name, labels);
        this.counters.set(key, (this.counters.get(key) ?? 0) + value);
    }

    setGauge(name: string, labels: Labels, value: number): void {
        this.trackName(name, labels, 'gauge');
        this.gauges.set(this.seriesKey(name, labels), value);
    }

    incrementGauge(name: string, labels: Labels, value = 1): void {
        this.trackName(name, labels, 'gauge');
        const key = this.seriesKey(name, labels);
        this.gauges.set(key, (this.gauges.get(key) ?? 0) + value);
    }

    decrementGauge(name: string, labels: Labels, value = 1): void {
        this.incrementGauge(name, labels, -value);
    }

    observeHistogram(name: string, labels: Labels, value: number): void {
        const series = this.histogramSeries(name, labels);
        // Values above the last finite bucket only move the totals; the
        // +Inf bucket rendered from the count covers them.
        for (let i = 0; i < series.bounds.length; i++) {
            const bound = series.bounds[i];
            if (bound !== undefined && value <= bound) {
                series.counts[i] = (series.counts[i] ?? 0) + 1;
                break;
            }
        }
        series.sum += value;
        series.count += 1;
    }

    render(): string {
        const lines: string[] = [];
        const allNames = [...this.names.keys(), ...this.histograms.keys()].filter(
            (name, index, all) => all.indexOf(name) === index,
        );

        for (const name of allNames.sort()) {
            const isHistogram = this.histograms.has(name);
            lines.push(`# HELP ${name} ${METRIC_HELP[name] ?? name}`);
            lines.push(`# TYPE ${name} ${isHistogram ? 'histogram' : 'counter'}`);

            if (isHistogram) {
                lines.push(...this.renderHistogram(name));
            } else {
                lines.push(...this.renderSeries(name));
            }
        }

        return lines.length === 0 ? '' : `${lines.join('\n')}\n`;
    }

    // -- internals ----------------------------------------------------------

    private seriesKey(name: string, labels: Labels): string {
        return `${name}\u0002${labelKey(labels)}`;
    }

    private trackName(name: string, labels: Labels, kind: 'counter' | 'gauge'): void {
        let entry = this.names.get(name);
        if (!entry) {
            entry = { kind, series: new Map<string, Labels>() };
            this.names.set(name, entry);
        }
        entry.series.set(labelKey(labels), labels);
    }

    private histogramSeries(name: string, labels: Labels): HistogramSeries {
        let byKey = this.histograms.get(name);
        if (!byKey) {
            byKey = new Map<string, { labels: Labels; series: HistogramSeries }>();
            this.histograms.set(name, byKey);
        }
        const key = labelKey(labels);
        let entry = byKey.get(key);
        if (!entry) {
            const bounds = HISTOGRAM_BUCKETS[name] ?? HTTP_DURATION_BUCKETS;
            entry = {
                labels,
                series: { bounds, counts: bounds.map(() => 0), sum: 0, count: 0 },
            };
            byKey.set(key, entry);
        }
        return entry.series;
    }

    private renderSeries(name: string): string[] {
        const entry = this.names.get(name);
        if (!entry) return [];
        const store = entry.kind === 'gauge' ? this.gauges : this.counters;
        const lines: string[] = [];
        for (const [, labels] of [...entry.series.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
            const value = store.get(this.seriesKey(name, labels)) ?? 0;
            lines.push(`${name}${labelBlock(labels)} ${value}`);
        }
        return lines;
    }

    private renderHistogram(name: string): string[] {
        const byKey = this.histograms.get(name);
        if (!byKey) return [];
        const lines: string[] = [];
        for (const [, entry] of [...byKey.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
            const { labels, series } = entry;
            let cumulative = 0;
            for (let i = 0; i < series.bounds.length; i++) {
                cumulative += series.counts[i] ?? 0;
                const bucketLabels = { ...labels, le: String(series.bounds[i]) };
                lines.push(`${name}_bucket${labelBlock(bucketLabels)} ${cumulative}`);
            }
            const infLabels = { ...labels, le: '+Inf' };
            lines.push(`${name}_bucket${labelBlock(infLabels)} ${series.count}`);
            lines.push(`${name}_sum${labelBlock(labels)} ${series.sum}`);
            lines.push(`${name}_count${labelBlock(labels)} ${series.count}`);
        }
        return lines;
    }
}
