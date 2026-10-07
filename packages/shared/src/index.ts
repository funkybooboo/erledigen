/**
 * @erledigen/shared
 *
 * Shared types, utilities, and constants for the Erledigen task app
 */

export { BaseConfigProvider } from './adapters/config/BaseConfigProvider';
// Adapters - Config
export type { ConfigProvider } from './adapters/config/ConfigProvider';
export { ConfigError } from './adapters/config/ConfigProvider';
// Adapters - Date
export type { DateProvider } from './adapters/date/DateProvider';
export { NativeDateProvider } from './adapters/date/NativeDateProvider';
export {
    type CsvColumn,
    CsvExportAdapter,
    DEFAULT_CSV_COLUMNS,
} from './adapters/export/CsvExportAdapter';
// Adapters - Export / Import
export type { ExportAdapter } from './adapters/export/ExportAdapter';
export { IcalExportAdapter } from './adapters/export/IcalExportAdapter';
export { JsonExportAdapter } from './adapters/export/JsonExportAdapter';
export { MarkdownExportAdapter } from './adapters/export/MarkdownExportAdapter';
export { FetchHttpClient } from './adapters/http/FetchHttpClient';
// Adapters - HTTP Client
export type { HttpClient, RequestOptions } from './adapters/http/HttpClient';
export { HttpClientError } from './adapters/http/HttpClient';
export { autoDetectCsvMapping, CsvImportAdapter } from './adapters/import/CsvImportAdapter';
export { IcalImportAdapter } from './adapters/import/IcalImportAdapter';
export type { ImportAdapter } from './adapters/import/ImportAdapter';
// Thrown across the package boundary by every import adapter on an
// unusable source document (HolidayService's .ics import included).
export { ImportValidationError } from './adapters/import/ImportValidationError';
export { JsonRestoreImportAdapter } from './adapters/import/JsonRestoreImportAdapter';
export { ThingsJsonImportAdapter } from './adapters/import/ThingsJsonImportAdapter';
export { TodoistCsvImportAdapter } from './adapters/import/TodoistCsvImportAdapter';
// Adapters - IO
export {
    ConsoleLogger,
    type LogFormat,
    type LoggerDestination,
} from './adapters/logging/ConsoleLogger';
// Adapters - Logging
export type { LogContext, Logger } from './adapters/logging/Logger';
export { LogLevel } from './adapters/logging/Logger';
export { RequestLogger } from './adapters/logging/RequestLogger';
// Adapters - Metrics
export type { MetricsAdapter } from './adapters/metrics/MetricsAdapter';
export {
    DB_SIZE_BYTES,
    HTTP_REQUEST_DURATION_SECONDS,
    HTTP_REQUESTS_ACTIVE,
    HTTP_REQUESTS_TOTAL,
    JOB_DURATION_SECONDS,
    JOBS_PENDING,
    JOBS_RUNNING,
    JOBS_TOTAL,
    TASKS_TOTAL,
    UPTIME_SECONDS,
    WS_CONNECTIONS_ACTIVE,
} from './adapters/metrics/metricNames';
export { NullMetricsAdapter } from './adapters/metrics/NullMetricsAdapter';
export { PrometheusMetricsAdapter } from './adapters/metrics/PrometheusMetricsAdapter';
// Constants
export {
    ACCENT_SCHEMES,
    API_ROUTES,
    CONTENT_TYPE_TEXT,
    DEFAULT_RATE_LIMIT_RPM,
    DEFAULT_TAG_KIND_MAP,
    DEFAULT_TAG_KINDS,
    HABIT_HEATMAP_WEEKS,
    HABIT_HEATMAP_WINDOW_DAYS,
    PRIORITY_TAGS,
    PURGE_RETENTION_DAYS,
    RECURRING_TASK_DEFAULTS,
    SOMEDAY_KEY,
    TASK_CONSTRAINTS,
    TASK_DEFAULTS,
    USER_PREFERENCES_DEFAULTS,
    WEEKDAY_ABBREVIATIONS,
} from './constants';
// Errors
export type { AppErrorJson } from './errors/AppError';
export {
    AppError,
    BadRequestError,
    ConflictError,
    createNotFoundError,
    ForbiddenError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
} from './errors/AppError';
export type { ApiResponse, ErrorResponseBody } from './types/api';
// Types
export type {
    DayNote,
    DayNoteUpsertResult,
    UpsertDayNoteInput,
} from './types/dayNote';
// Types - export/import contract (ADR-008, ADR-009)
export type { ExportFormat, ExportSnapshot } from './types/export';
export { EXPORT_FORMAT_META, EXPORT_FORMATS } from './types/export';
export type { CreateHolidayInput, Holiday, UpdateHolidayInput } from './types/holiday';
export type {
    CsvColumnMapping,
    CsvImportField,
    ImportedTask,
    ImportFormat,
    ImportIssue,
    ImportResult,
    ParsedTasks,
} from './types/import';
export { CSV_IMPORT_FIELDS, IMPORT_FORMAT_META, IMPORT_FORMATS } from './types/import';
export type { CreateProjectInput, Project, UpdateProjectInput } from './types/project';
export type {
    AdoptTaskAsRecurringInput,
    AdoptTaskAsRecurringResult,
    CreateRecurringTaskInput,
    RecurringFrequency,
    RecurringTask,
    RecurringTaskStats,
    RecurringTaskStatsWithHistory,
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
    AccentSchemeId,
    ActiveFilters,
    DeleteConfirmationType,
    RolloverTriggerTime,
    TagKind,
    TagKindBehavior,
    ThemeType,
    TimeFormatType,
    UpdateUserPreferencesInput,
    UserPreferences,
} from './types/userPreferences';
export { isValidTimeZone, normalizeActiveFilters } from './types/userPreferences';
export type {
    ConnectionAckPayload,
    ConnectionStatus,
    RecurringTaskGeneratedPayload,
    ServerShutdownPayload,
    TagMergedPayload,
    TagRenamedPayload,
    WsClientEventType,
    WsClientMessage,
    WsServerEventMap,
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
    addMonths,
    dateRangeKeys,
    daysBetween,
    describeRecurrence,
    distributionWindowStart,
    extractDatePhrase,
    extractInlineTags,
    formatTags,
    generateOccurrences,
    getTagsByKind,
    groupTasksByDate,
    hasDeadlineTag,
    monthKeyOf,
    monthRangeKeys,
    nextOccurrenceIso,
    parseRecurrence,
    parseTags,
    planProjectDistribution,
    renderInlineMarkdown,
    renderMarkdown,
    resolveDatePhrase,
    slugify,
    splitKey,
    weekdayOf,
} from './utils';
export type { ParsedDatePhrase } from './utils/parseDatePhrase';
export type { ParsedRecurrence, RecurrenceSchedule } from './utils/parseRecurrence';
export type { ExtractedInlineTags } from './utils/parseTags';
export type {
    DistributionAssignment,
    DistributionOptions,
} from './utils/projectDistribution';
