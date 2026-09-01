import { type LogContext, type Logger, LogLevel } from './Logger';

/**
 * Where log lines are written.
 *
 * The logger never touches a sink directly — it formats a line and hands it
 * to this interface. That keeps a single choke point for "where do logs go":
 * swap the destination (files, a remote collector, test capture) without
 * touching any call site. The default routes debug/info to stdout and
 * warn/error to stderr (via console.log/console.error, which map to those
 * streams under Bun/Node and to the console in the browser).
 */
export interface LoggerDestination {
    /** Sink for debug/info lines (stdout by default). */
    out(line: string): void;
    /** Sink for warn/error lines (stderr by default). */
    err(line: string): void;
}

const consoleDestination: LoggerDestination = {
    out: line => console.log(line),
    err: line => console.error(line),
};

/**
 * Console-based logger implementation
 *
 * Outputs log messages to the configured destination (stdout/stderr by
 * default) with timestamps and context. Log level is configured via
 * constructor parameter.
 */
export class ConsoleLogger implements Logger {
    protected minLevel: LogLevel;
    private destination: LoggerDestination;

    constructor(
        minLevel: LogLevel = LogLevel.INFO,
        destination: LoggerDestination = consoleDestination,
    ) {
        this.minLevel = minLevel;
        this.destination = destination;
    }

    private shouldLog(level: LogLevel): boolean {
        const levels: LogLevel[] = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
        const minIndex = levels.indexOf(this.minLevel);
        const currentIndex = levels.indexOf(level);
        return currentIndex >= minIndex;
    }

    private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString();
        const contextStr = context ? ` ${JSON.stringify(context)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
    }

    debug(message: string, context?: LogContext): void {
        if (!this.shouldLog(LogLevel.DEBUG)) return;
        this.destination.out(this.formatMessage(LogLevel.DEBUG, message, context));
    }

    info(message: string, context?: LogContext): void {
        if (!this.shouldLog(LogLevel.INFO)) return;
        this.destination.out(this.formatMessage(LogLevel.INFO, message, context));
    }

    warn(message: string, context?: LogContext): void {
        if (!this.shouldLog(LogLevel.WARN)) return;
        this.destination.err(this.formatMessage(LogLevel.WARN, message, context));
    }

    error(message: string, error?: Error | unknown, context?: LogContext): void {
        if (!this.shouldLog(LogLevel.ERROR)) return;

        const errorContext =
            error instanceof Error
                ? { ...context, error: error.message, stack: error.stack }
                : { ...context, error };

        this.destination.err(this.formatMessage(LogLevel.ERROR, message, errorContext));
    }
}
