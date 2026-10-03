export type ThemeType = 'light' | 'dark' | 'system';
export type DeleteConfirmationType = 'instant' | 'confirm';
export type TimeFormatType = '12h' | '24h';

/** When the daily rollover job runs (server timezone). 'manual' = no
 *  daily schedule; stale tasks are only caught up at server startup. */
export type RolloverTriggerTime = 'midnight' | '9am' | 'manual';

/** Validates that a string is a known IANA timezone via Intl. */
export function isValidTimeZone(timeZone: string): boolean {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone });
        return true;
    } catch {
        return false;
    }
}

export type TagKindBehavior = 'single' | 'multiple';

export interface TagKind {
    id: string;
    name: string;
    behavior: TagKindBehavior;
    prefix: string | null;
    sortOrder: number;
    color: string | null;
}

export interface ActiveFilters {
    tags: string[];
    showCompleted: boolean;
    /** How tasks order within a day section: 'manual' = the default
     *  position/creation order; 'priority' = p1 -> p2 -> p3 -> untagged. */
    sortMode: 'manual' | 'priority';
    /** Inclusive date-range filter bounds (YYYY-MM-DD). null = open end.
     *  Tasks without a date (Someday) are never hidden by the range. */
    dateFrom: string | null;
    dateTo: string | null;
}

/** Fill missing/invalid filter fields with defaults. Older persisted
 *  preferences (and older snapshots) predate the later fields -- this
 *  normalizes any stored shape into a well-formed ActiveFilters. */
export function normalizeActiveFilters(
    raw: Partial<ActiveFilters> | null | undefined,
): ActiveFilters {
    return {
        tags: Array.isArray(raw?.tags) ? raw.tags : [],
        showCompleted: raw?.showCompleted ?? true,
        sortMode: raw?.sortMode === 'priority' ? 'priority' : 'manual',
        dateFrom: typeof raw?.dateFrom === 'string' ? raw.dateFrom : null,
        dateTo: typeof raw?.dateTo === 'string' ? raw.dateTo : null,
    };
}

export interface UserPreferences {
    id: 'default';
    theme: ThemeType;
    locale: string;
    someDayPanelWidth: number;
    someDayPanelCollapsed: boolean;
    someDayPanelLastOpenWidth: number;
    rolloverEnabled: boolean;
    rolloverTriggerTime: RolloverTriggerTime;
    showEmptyDays: boolean;
    deleteConfirmation: DeleteConfirmationType;
    activeFilters: ActiveFilters;
    tagKinds: TagKind[];
    tagKindMap: Record<string, string>;
    timeFormat: TimeFormatType;
    /** IANA timezone (e.g. 'America/Denver') or null to follow the device zone. */
    timezone: string | null;
    updatedAt: string;
}

export type UpdateUserPreferencesInput = Partial<Omit<UserPreferences, 'id' | 'updatedAt'>>;
