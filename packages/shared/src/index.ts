/**
 * @erledigen/shared
 *
 * Shared types, utilities, and constants for the Erledigen task app
 */

// Adapters - Config
export type { ConfigProvider } from './adapters/config/ConfigProvider';
export { ConfigError } from './adapters/config/ConfigProvider';
// Adapters - Date
export type { DateProvider } from './adapters/date/DateProvider';
export { DateProviderError } from './adapters/date/DateProvider';
export { NativeDateProvider } from './adapters/date/NativeDateProvider';
export { FetchHttpClient } from './adapters/http/FetchHttpClient';
// Adapters - HTTP Client
export type { HttpClient, RequestOptions } from './adapters/http/HttpClient';
export { HttpClientError } from './adapters/http/HttpClient';
// Adapters - IO
export { ConsoleLogger, type LoggerDestination } from './adapters/logging/ConsoleLogger';
// Adapters - Logging
export type { LogContext, Logger } from './adapters/logging/Logger';
export { LogLevel } from './adapters/logging/Logger';
// Constants
export {
    API_ROUTES,
    CONTENT_TYPE_TEXT,
    DEFAULT_RATE_LIMIT_RPM,
    DEFAULT_TAG_KIND_MAP,
    DEFAULT_TAG_KINDS,
    PURGE_RETENTION_DAYS,
    RECURRING_TASK_DEFAULTS,
    SOMEDAY_KEY,
    TASK_CONSTRAINTS,
    TASK_DEFAULTS,
    USER_PREFERENCES_DEFAULTS,
    WEEKDAY_ABBREVIATIONS,
    WEEKDAY_NAMES,
} from './constants';
// Errors
export type { AppErrorJson } from './errors/AppError';
export {
    AppError,
    BadRequestError,
    ConflictError,
    createNotFoundError,
    createValidationError,
    ForbiddenError,
    InternalServerError,
    NotFoundError,
    RateLimitError,
    UnauthorizedError,
    ValidationError,
} from './errors/AppError';
export type { ApiResponse, ErrorResponseBody } from './types/api';
// Types
export type { CreateProjectInput, Project, UpdateProjectInput } from './types/project';
export type {
    CreateRecurringTaskInput,
    RecurringFrequency,
    RecurringTask,
    RecurringTaskStats,
    UpdateRecurringTaskInput,
} from './types/recurringTask';
export type {
    CreateSomeDayGroupInput,
    SomeDayGroup,
    UpdateSomeDayGroupInput,
} from './types/someDayGroup';
export type { CreateTaskInput, Task, UpdateTaskInput } from './types/task';
export {
    isValidTimeRange,
    isValidTimeString,
} from './types/task';
export type {
    ActiveFilters,
    DeleteConfirmationType,
    TagKind,
    TagKindBehavior,
    ThemeType,
    TimeFormatType,
    UpdateUserPreferencesInput,
    UserPreferences,
} from './types/userPreferences';
export { isValidTimeZone } from './types/userPreferences';
export type {
    ConnectionAckPayload,
    ConnectionStatus,
    RecurringTaskGeneratedPayload,
    ServerShutdownPayload,
    TagMergedPayload,
    TagRenamedPayload,
    WsClientEventType,
    WsClientMessage,
    WsServerEventType,
    WsServerMessage,
} from './types/websocket';
export {
    WS_PING_INTERVAL_MS,
    WS_RECONNECT_BASE_MS,
    WS_RECONNECT_MAX_MS,
} from './types/websocket';
// Utilities
export {
    addDays,
    dateRangeKeys,
    daysBetween,
    describeRecurrence,
    formatFrequency,
    formatTags,
    formatTime12,
    generateOccurrences,
    getTagsByKind,
    groupTasksByDate,
    hasDeadlineTag,
    keyFromParts,
    nextOccurrenceIso,
    parseRecurrence,
    parseTags,
    resolveTagKind,
    slugify,
    splitKey,
    weekdayOf,
} from './utils';
export type { ParsedRecurrence, RecurrenceSchedule } from './utils/parseRecurrence';
