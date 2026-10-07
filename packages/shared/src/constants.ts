/**
 * Shared constants
 */

/**
 * Validation constraints
 */
export const TASK_CONSTRAINTS = {
    MAX_TEXT_LENGTH: 500,
    MIN_TEXT_LENGTH: 1,
} as const;

/**
 * API routes
 */
export const API_ROUTES = {
    // Health & metrics
    HEALTH: '/api/health',
    METRICS: '/api/metrics',
    /** Orchestrator probes (ADR-018): liveness is the process, readiness
     *  is the dependencies -- deliberately separate from the rich
     *  human-oriented /api/health. */
    HEALTHZ: '/healthz',
    READYZ: '/readyz',

    // Tasks
    TASKS: '/api/tasks',
    TASK_BY_ID: (id: string) => `/api/tasks/${id}`,
    TASK_RESTORE: (id: string) => `/api/tasks/${id}/restore`,
    TASK_TRASH: '/api/tasks/trash',
    TASK_PURGE: '/api/tasks/purge',

    // Someday groups
    SOMEDAY_GROUPS: '/api/someday-groups',
    SOMEDAY_GROUP_BY_ID: (id: string) => `/api/someday-groups/${id}`,

    // Holidays (v0.9.0)
    HOLIDAYS: '/api/holidays',
    HOLIDAY_BY_ID: (id: string) => `/api/holidays/${id}`,
    HOLIDAY_IMPORT: '/api/holidays/import',

    // Day notes (one per date, upsert-by-date)
    DAY_NOTES: '/api/day-notes',
    DAY_NOTE_BY_DATE: (date: string) => `/api/day-notes/${date}`,

    // Projects
    PROJECTS: '/api/projects',
    PROJECT_BY_ID: (id: string) => `/api/projects/${id}`,
    PROJECT_ACTIVATE: (id: string) => `/api/projects/${id}/activate`,
    PROJECT_DEACTIVATE: (id: string) => `/api/projects/${id}/deactivate`,

    // Recurring tasks
    RECURRING_TASKS: '/api/recurring-tasks',
    RECURRING_TASKS_ADOPT: '/api/recurring-tasks/adopt',
    RECURRING_TASK_BY_ID: (id: string) => `/api/recurring-tasks/${id}`,
    RECURRING_TASK_GENERATE: (id: string) => `/api/recurring-tasks/${id}/generate`,
    RECURRING_TASKS_GENERATE_ALL: '/api/recurring-tasks/generate-all',
    RECURRING_TASK_STATS: (id: string) => `/api/recurring-tasks/${id}/stats`,

    // Tags
    TAGS: '/api/tags',
    TAG_INFO: '/api/tags/info',
    TAG_RENAME: '/api/tags/rename',
    TAG_MERGE: '/api/tags/merge',

    // User preferences
    USER_PREFERENCES: '/api/preferences',

    // Export/import (ADR-008, ADR-009)
    EXPORT: '/api/export',
    IMPORT: '/api/import',

    // OpenAPI
    OPENAPI_YAML: '/openapi.yaml',
    OPENAPI_JSON: '/openapi.json',

    // Route patterns (for server-side path param extraction)
    TASK_ROUTE_PATTERN: '/api/tasks/:id',
    TASK_RESTORE_PATTERN: '/api/tasks/:id/restore',
    PROJECT_ROUTE_PATTERN: '/api/projects/:id',
    PROJECT_ACTIVATE_PATTERN: '/api/projects/:id/activate',
    PROJECT_DEACTIVATE_PATTERN: '/api/projects/:id/deactivate',
    RECURRING_TASK_ROUTE_PATTERN: '/api/recurring-tasks/:id',
    RECURRING_TASKS_ADOPT_PATTERN: '/api/recurring-tasks/adopt',
    RECURRING_TASK_GENERATE_PATTERN: '/api/recurring-tasks/:id/generate',
    RECURRING_TASK_GENERATE_ALL_PATTERN: '/api/recurring-tasks/generate-all',
    RECURRING_TASK_STATS_PATTERN: '/api/recurring-tasks/:id/stats',
    SOMEDAY_GROUP_ROUTE_PATTERN: '/api/someday-groups/:id',
    HOLIDAY_ROUTE_PATTERN: '/api/holidays/:id',
    DAY_NOTE_ROUTE_PATTERN: '/api/day-notes/:date',
} as const;

export const TASK_DEFAULTS = {
    rolloverEnabled: false,
    tags: [] as string[],
} as const;

export const RECURRING_TASK_DEFAULTS = {
    rolloverEnabled: true,
    interval: 1,
    tags: [] as string[],
} as const;

export const PURGE_RETENTION_DAYS = 7;
/** Matches the compose stacks' default (600) so bare `bun src/index.ts`
 *  runs behave like containerized ones; override with RATE_LIMIT_RPM. */
export const DEFAULT_RATE_LIMIT_RPM = 600;

/** The selectable accent schemes (USE-3): each is a full accent palette
 *  drawn from the logo's pill colors -- blue is the Fizzy link blue the
 *  app has always shipped (sibling of the logo's blue pill), coral takes
 *  the red pill's hue, amber the yellow pill's. The ids are the API
 *  values and the CSS [data-accent] keys; `label` is what the Theme
 *  modal shows. */
export const ACCENT_SCHEMES: ReadonlyArray<{
    id: import('./types/userPreferences').AccentSchemeId;
    label: string;
}> = [
    { id: 'blue', label: 'Blue' },
    { id: 'coral', label: 'Coral' },
    { id: 'amber', label: 'Amber' },
];

/** Habit heatmap (GitHub-style year grid) geometry. The window is
 *  53 weeks: the widest grid a calendar year can render (a year
 *  spanning 53 Sundays), so the server's completedDates window
 *  always covers every cell the client draws. */
export const HABIT_HEATMAP_WEEKS = 53;
export const HABIT_HEATMAP_WINDOW_DAYS = HABIT_HEATMAP_WEEKS * 7;

export const DEFAULT_TAG_KINDS: import('./types/userPreferences').TagKind[] = [
    {
        id: 'priority',
        name: 'Priority',
        behavior: 'single',
        prefix: null,
        sortOrder: 0,
        color: null,
    },
    {
        id: 'project',
        name: 'Project',
        behavior: 'single',
        prefix: 'project:',
        sortOrder: 1,
        color: null,
    },
];

export const DEFAULT_TAG_KIND_MAP: Record<string, string> = {
    p1: 'priority',
    p2: 'priority',
    p3: 'priority',
};

/** The priority tags, highest priority first (p1 ranks above p2).
 *  Shared by the client's priority sort/toggle logic and the CSV
 *  adapters' priority column; DEFAULT_TAG_KIND_MAP above maps each of
 *  these to the 'priority' tag kind. */
export const PRIORITY_TAGS: readonly string[] = ['p1', 'p2', 'p3'];

export const USER_PREFERENCES_DEFAULTS = {
    theme: 'system' as const,
    accent: 'blue' as const,
    locale: 'en',
    someDayPanelWidth: 280,
    someDayPanelCollapsed: false,
    someDayPanelLastOpenWidth: 280,
    rolloverEnabled: true,
    rolloverTriggerTime: 'midnight' as const,
    showEmptyDays: true,
    deleteConfirmation: 'instant' as const,
    activeFilters: {
        tags: [] as string[],
        showCompleted: true,
        sortMode: 'manual' as const,
        dateFrom: null as string | null,
        dateTo: null as string | null,
    },
    tagKinds: DEFAULT_TAG_KINDS,
    tagKindMap: { ...DEFAULT_TAG_KIND_MAP },
    timeFormat: '12h' as const,
    timezone: null as string | null,
} as const;

export const SOMEDAY_KEY = '__someday__';

export const WEEKDAY_ABBREVIATIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_NAMES = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
] as const;

export const MONTH_ABBREVIATIONS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
] as const;
export const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
] as const;

export const CONTENT_TYPE_TEXT = 'text/plain; charset=utf-8';
