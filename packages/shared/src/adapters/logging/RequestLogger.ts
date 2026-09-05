/**
 * Child logger with captured default context (see ADR-004)
 *
 * Wraps a parent Logger so every line it writes carries a fixed set of
 * context keys (e.g. `requestId` for one HTTP request, `jobId`/`jobType`
 * for one background job execution) merged under the per-call context.
 * Context passing stays explicit -- no async local storage -- so the
 * correlation is visible in the dependency graph and trivially testable.
 */

import type { LogContext, Logger } from './Logger';

export class RequestLogger implements Logger {
    constructor(
        private readonly parent: Logger,
        private readonly defaultContext: LogContext,
    ) {}

    debug(message: string, context?: LogContext): void {
        this.parent.debug(message, this.merge(context));
    }

    info(message: string, context?: LogContext): void {
        this.parent.info(message, this.merge(context));
    }

    warn(message: string, context?: LogContext): void {
        this.parent.warn(message, this.merge(context));
    }

    error(message: string, error?: Error | unknown, context?: LogContext): void {
        this.parent.error(message, error, this.merge(context));
    }

    /** Per-call context wins over the captured default for the same key. */
    private merge(context?: LogContext): LogContext {
        return { ...this.defaultContext, ...context };
    }
}
