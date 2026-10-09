export type ThemeType = 'light' | 'dark' | 'system';
export type DeleteConfirmationType = 'instant' | 'confirm';
export type TimeFormatType = '12h' | '24h';

/** The accent scheme ids. Each is an accent palette drawn from the
 *  logo's pill colors (see ACCENT_SCHEMES in constants.ts): 'blue' is
 *  the default and stays the :root token set; 'coral' and 'amber' take
 *  their hues from the logo's red and yellow pills. */
export type AccentSchemeId = 'blue' | 'coral' | 'amber';

/** The tag color palette ids (USE-4). Each id maps to a --tag-<id> CSS
 *  token (light + dark variants in app.css); values of the tagColors
 *  map on UserPreferences are exactly these ids. */
export type TagColorId = 'coral' | 'amber' | 'lime' | 'sage' | 'sky' | 'violet' | 'rose' | 'slate';

/** The app's reading sizes (USE-7): 'medium' is the shipped default.
 *  Drives the --fs-* CSS tokens via [data-font-size] on the root. */
export type FontSize = 'small' | 'medium' | 'large';

/** Task row spacing (USE-7): 'comfortable' is the shipped default.
 *  Drives the --row-* CSS tokens via [data-row-density] on the root. */
export type RowDensity = 'compact' | 'comfortable';

/** The completion pulse preference (USE-6/USE-7): 'flash' is the default
 *  motion; 'none' turns the completion animation off entirely. */
export type CompletionAnimation = 'flash' | 'none';

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
    /** Accent palette id (ACCENT_SCHEMES) -- 'blue' is the default. */
    accent: AccentSchemeId;
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
    /** Per-tag color overrides (USE-4): tag name -> palette id
     *  (TagColorId). Tags absent from the map get the auto-assigned or
     *  priority-semantic color; the map only ever holds explicit choices
     *  plus the client's auto-assignments, both persisted here. */
    tagColors: Record<string, TagColorId>;
    timeFormat: TimeFormatType;
    /** Reading size of the day-list surfaces ('medium' default). */
    fontSize: FontSize;
    /** Task-row spacing ('comfortable' default). */
    rowDensity: RowDensity;
    /** The completion pulse ('flash' default; 'none' disables). */
    completionAnimation: CompletionAnimation;
    /** IANA timezone (e.g. 'America/Denver') or null to follow the device zone. */
    timezone: string | null;
    updatedAt: string;
}

export type UpdateUserPreferencesInput = Partial<Omit<UserPreferences, 'id' | 'updatedAt'>>;
