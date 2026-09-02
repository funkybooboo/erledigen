import type {
    ActiveFilters,
    DeleteConfirmationType,
    TagKind,
    ThemeType,
    TimeFormatType,
    UserPreferences,
} from '@erledigen/shared';
import {
    DEFAULT_TAG_KIND_MAP,
    DEFAULT_TAG_KINDS,
    isValidTimeZone,
    USER_PREFERENCES_DEFAULTS,
} from '@erledigen/shared';
import { container } from '$lib/container';
import { PreferencesService } from '$lib/services/preferencesService';

const preferencesService = new PreferencesService(container.httpClient);

/** The preference fields this store actually holds and can save or roll
 *  back: UserPreferences minus the fixed id/updatedAt and the vestigial
 *  someDayPanelCollapsed (persisted by the API, but no client code holds
 *  it). Narrowing the accepted keys keeps save()/persistPreferences from
 *  Object.assign-ing a field the class never declared -- that would be a
 *  plain (non-$state, non-reactive) property. */
type SavablePreferences = Omit<UserPreferences, 'id' | 'updatedAt' | 'someDayPanelCollapsed'>;

/** Fire-and-forget preference persistence. These updates are intentionally
 *  non-blocking and invisible to the UI, so log (don't surface) failures. */
function persistPreferences(update: Partial<SavablePreferences>) {
    return preferencesService.update(update).catch(error => {
        container.logger.warn('Failed to persist preferences', {
            keys: Object.keys(update),
            error: error instanceof Error ? error.message : String(error),
        });
    });
}

class PreferencesStore {
    id = $state('default');
    theme = $state<ThemeType>('system');
    locale = $state('en');
    someDayPanelWidth = $state<number>(USER_PREFERENCES_DEFAULTS.someDayPanelWidth);
    someDayPanelLastOpenWidth = $state<number>(USER_PREFERENCES_DEFAULTS.someDayPanelLastOpenWidth);
    rolloverEnabled = $state(true);
    showEmptyDays = $state(true);
    deleteConfirmation = $state<DeleteConfirmationType>('instant');
    activeFilters = $state<ActiveFilters>({
        tags: [],
        showCompleted: true,
    });
    tagKinds = $state<TagKind[]>([...DEFAULT_TAG_KINDS]);
    tagKindMap = $state<Record<string, string>>({ ...DEFAULT_TAG_KIND_MAP });
    timeFormat = $state<TimeFormatType>('12h');
    timezone = $state<string | null>(null);
    updatedAt = $state(new Date().toISOString());

    toggleTag(tag: string) {
        if (this.activeFilters.tags.includes(tag)) {
            this.activeFilters = {
                ...this.activeFilters,
                tags: this.activeFilters.tags.filter(t => t !== tag),
            };
        } else {
            this.activeFilters = { ...this.activeFilters, tags: [...this.activeFilters.tags, tag] };
        }
        persistPreferences({ activeFilters: this.activeFilters });
    }

    setTags(tags: string[]) {
        this.activeFilters = { ...this.activeFilters, tags };
        persistPreferences({ activeFilters: this.activeFilters });
    }

    clearAll() {
        this.activeFilters = { tags: [], showCompleted: true };
        persistPreferences({ activeFilters: this.activeFilters });
    }

    get activeFilterCount() {
        return this.activeFilters.tags?.length ?? 0;
    }

    async load() {
        try {
            const prefs = await preferencesService.get();
            this.id = prefs.id;
            this.theme = prefs.theme;
            this.locale = prefs.locale;
            this.someDayPanelWidth = prefs.someDayPanelWidth;
            this.someDayPanelLastOpenWidth =
                prefs.someDayPanelLastOpenWidth ??
                USER_PREFERENCES_DEFAULTS.someDayPanelLastOpenWidth;
            this.rolloverEnabled = prefs.rolloverEnabled;
            this.showEmptyDays = prefs.showEmptyDays;
            this.deleteConfirmation = prefs.deleteConfirmation ?? 'instant';
            this.activeFilters = prefs.activeFilters;
            this.tagKinds = prefs.tagKinds ?? [...DEFAULT_TAG_KINDS];
            this.tagKindMap = prefs.tagKindMap ?? { ...DEFAULT_TAG_KIND_MAP };
            this.timeFormat = prefs.timeFormat ?? '12h';
            this.timezone = prefs.timezone ?? null;
            this.updatedAt = prefs.updatedAt;
            container.setDateProviderTimeZone(this.timezone);
        } catch (error) {
            // Use defaults
            container.logger.warn('Failed to load preferences -- using defaults', {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /** Apply `partial` optimistically, persist, and roll back the TOUCHED
     *  keys on failure. Snapshotting only the touched keys keeps the
     *  rollback in lockstep with the store's fields; the previous
     *  hand-maintained full-field snapshot was a third copy of the
     *  preference list that silently drifted whenever a field was added. */
    async save(partial: Partial<SavablePreferences>): Promise<void> {
        const touched = Object.keys(partial) as (keyof SavablePreferences)[];
        // keyof SavablePreferences is exactly this store's own $state
        // fields, so the rollback snapshot can read them directly -- no
        // record cast, and a key the store does not hold cannot enter.
        const before = Object.fromEntries(
            touched.map(key => [key, this[key]]),
        ) as Partial<SavablePreferences>;

        Object.assign(this, partial);

        try {
            const updated = await preferencesService.update(partial);
            // The response carries every persisted field, including
            // someDayPanelCollapsed which this store does not hold; strip
            // it so only declared (reactive) fields are assigned.
            const { someDayPanelCollapsed, ...savable } = updated;
            void someDayPanelCollapsed;
            Object.assign(this, savable);
        } catch (error) {
            container.logger.warn('Failed to save preferences -- rolling back', {
                keys: touched,
                error: error instanceof Error ? error.message : String(error),
            });
            Object.assign(this, before);
        }
    }

    setTheme(theme: ThemeType) {
        this.theme = theme;
        persistPreferences({ theme });
    }

    setPanelWidth(width: number) {
        this.someDayPanelWidth = width;
        if (width >= 200) {
            this.someDayPanelLastOpenWidth = width;
        }
        persistPreferences({
            someDayPanelWidth: width,
            someDayPanelLastOpenWidth: this.someDayPanelLastOpenWidth,
        });
    }

    setDeleteConfirmation(value: DeleteConfirmationType) {
        this.deleteConfirmation = value;
        persistPreferences({ deleteConfirmation: value });
    }

    updateTagKinds(tagKinds: TagKind[], tagKindMap: Record<string, string>) {
        this.tagKinds = tagKinds;
        this.tagKindMap = tagKindMap;
        persistPreferences({ tagKinds, tagKindMap });
    }

    setTimeFormat(format: TimeFormatType) {
        this.timeFormat = format;
        persistPreferences({ timeFormat: format });
    }

    /**
     * Set the timezone (IANA zone) or null for device-local. Validates via
     * isValidTimeZone; invalid values are ignored and the previous zone stays.
     * Pushes the live zone to the date provider so today()/clock update.
     */
    setTimezone(timezone: string | null) {
        if (timezone !== null && !isValidTimeZone(timezone)) return;
        const normalized = timezone === '' ? null : timezone;
        container.setDateProviderTimeZone(normalized);
        this.timezone = normalized;
        persistPreferences({ timezone: normalized });
    }
}

export const preferencesStore = new PreferencesStore();
