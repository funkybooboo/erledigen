import { describe, expect, it } from 'bun:test';
import { ConsoleLogger, type LoggerDestination } from './ConsoleLogger';
import { LogLevel } from './Logger';

/** Capturing destination so tests never write to real stdout/stderr. */
function createCaptureDestination(): LoggerDestination & {
    outLines: string[];
    errLines: string[];
} {
    const out: string[] = [];
    const err: string[] = [];
    return {
        out: line => out.push(line),
        err: line => err.push(line),
        outLines: out,
        errLines: err,
    };
}

describe('ConsoleLogger', () => {
    it('routes debug/info to the out sink and warn/error to the err sink', () => {
        const dest = createCaptureDestination();
        const logger = new ConsoleLogger(LogLevel.DEBUG, dest);

        logger.debug('d');
        logger.info('i');
        logger.warn('w');
        logger.error('e');

        expect(dest.outLines.length).toBe(2);
        expect(dest.errLines.length).toBe(2);
        expect(dest.outLines.at(0)).toContain('[DEBUG] d');
        expect(dest.outLines.at(1)).toContain('[INFO] i');
        expect(dest.errLines.at(0)).toContain('[WARN] w');
        expect(dest.errLines.at(1)).toContain('[ERROR] e');
    });

    it('filters messages below the configured minimum level', () => {
        const dest = createCaptureDestination();
        const logger = new ConsoleLogger(LogLevel.WARN, dest);

        logger.debug('nope');
        logger.info('nope');
        logger.warn('yes');
        logger.error('yes');

        expect(dest.outLines.length).toBe(0);
        expect(dest.errLines.length).toBe(2);
    });

    it('formats timestamps, level tags, and JSON context', () => {
        const dest = createCaptureDestination();
        const logger = new ConsoleLogger(LogLevel.INFO, dest);

        logger.info('task created', { id: '42', day: '2026-09-02' });

        const line = dest.outLines.at(0);
        expect(line).toMatch(
            /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] task created /,
        );
        expect(line?.endsWith('{"id":"42","day":"2026-09-02"}')).toBe(true);
    });

    it('serializes Error objects with message and stack into the context', () => {
        const dest = createCaptureDestination();
        const logger = new ConsoleLogger(LogLevel.ERROR, dest);

        const error = new Error('boom');
        logger.error('request failed', error, { path: '/api/tasks' });

        const line = dest.errLines.at(0);
        expect(line).toContain('[ERROR] request failed');
        expect(line).toContain('"path":"/api/tasks"');
        expect(line).toContain('"error":"boom"');
        expect(line).toContain('"stack"');
    });

    it('serializes non-Error throwables into the context', () => {
        const dest = createCaptureDestination();
        const logger = new ConsoleLogger(LogLevel.ERROR, dest);

        logger.error('request failed', 'plain string');

        expect(dest.errLines.at(0)).toContain('"error":"plain string"');
    });

    it('defaults to INFO level', () => {
        const dest = createCaptureDestination();
        const logger = new ConsoleLogger(LogLevel.INFO, dest);

        logger.debug('suppressed at default level');
        logger.info('shown at default level');

        expect(dest.outLines.length).toBe(1);
    });
});
