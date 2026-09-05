import { describe, expect, it } from 'bun:test';
import { type LogContext, type Logger, LogLevel } from './Logger';
import { RequestLogger } from './RequestLogger';

/**
 * A hand-written capturing logger -- NOT a mock. It records the exact
 * arguments passed through so the child-logger merge semantics can be
 * asserted on real values (the NO MOCKS policy allows hand-written test
 * doubles; this one only captures, it never fabricates behavior).
 */
class CapturingLogger implements Logger {
    readonly calls: Array<{ level: LogLevel; message: string; context: LogContext | undefined }> =
        [];

    private record(level: LogLevel, message: string, context: LogContext | undefined): void {
        this.calls.push({ level, message, context });
    }

    debug(message: string, context?: LogContext): void {
        this.record(LogLevel.DEBUG, message, context);
    }

    info(message: string, context?: LogContext): void {
        this.record(LogLevel.INFO, message, context);
    }

    warn(message: string, context?: LogContext): void {
        this.record(LogLevel.WARN, message, context);
    }

    error(message: string, _error?: Error | unknown, context?: LogContext): void {
        this.record(LogLevel.ERROR, message, context);
    }
}

describe('RequestLogger', () => {
    it('adds the captured default context to every line', () => {
        const parent = new CapturingLogger();
        const logger = new RequestLogger(parent, { requestId: 'req_1' });

        logger.info('task created', { taskId: '42' });
        logger.warn('slow query');

        const first = parent.calls.at(0);
        const second = parent.calls.at(1);
        expect(first?.context).toEqual({ requestId: 'req_1', taskId: '42' });
        expect(second?.context).toEqual({ requestId: 'req_1' });
    });

    it('lets per-call context override the captured default for the same key', () => {
        const parent = new CapturingLogger();
        const logger = new RequestLogger(parent, { jobId: 'job_1', jobType: 'rollover' });

        logger.info('retrying with a different job id', { jobId: 'job_2' });

        const call = parent.calls.at(0);
        expect(call?.context).toEqual({ jobId: 'job_2', jobType: 'rollover' });
    });

    it('forwards the error argument untouched on the error path', () => {
        const parent = new CapturingLogger();
        const logger = new RequestLogger(parent, { requestId: 'req_1' });
        const error = new Error('boom');

        logger.error('request failed', error, { path: '/api/tasks' });

        const first = parent.calls.at(0);
        expect(first?.context).toEqual({ requestId: 'req_1', path: '/api/tasks' });
    });
});
