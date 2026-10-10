import type {
    AccentSchemeId,
    ActiveFilters,
    CompletionAnimation,
    DeleteConfirmationType,
    FontSize,
    RolloverTriggerTime,
    RowDensity,
    TagColorId,
    TagKind,
    ThemeType,
    TimeFormatType,
    UserPreferences,
} from '@erledigen/shared';
import {
    DEFAULT_TAG_KIND_MAP,
    DEFAULT_TAG_KINDS,
    isValidTimeZone,
    normalizeActiveFilters,
    USER_PREFERENCES_DEFAULTS,
} from '@erledigen/shared';
import { container } from '$lib/container';
import { i18nStore } from '$lib/i18n/i18nStore.svelte';
import {
    applyShortcutOverrides,
    SHORTCUTS,
    type ShortcutRegistry,
    sanitizeShortcutOverrides,
} from '$lib/keybindings';
import { PreferencesService } from '$lib/services/preferencesService';

const preferencesService = new PreferencesService(container.httpClient);

/** The preference fields this store actually holds and can save or roll
 *  back: UserPreferences minus the fixed id/updatedAt and the vestigial
 *  someDayPanelCollapsed (persisted by the API, but no client code holds
 *  it). Narrowing the accepted keys keeps save() from Object.assign-ing a
 *  field the class never declared -- that would be a plain (non-$state,
 *  non-reactive) property. */
type SavablePreferences = Omit<UserPreferences, 'id' | 'updatedAt' | 'someDayPanelCollapsed'>;

class PreferencesStore {
    id = $state('default');
    theme = $state<ThemeType>('system');
    accent = $state<AccentSchemeId>('blue');
    locale = $state('en');
    someDayPanelWidth = $state<number>(USER_PREFERENCES_DEFAULTS.someDayPanelWidth);
    someDayPanelLastOpenWidth = $state<number>(USER_PREFERENCES_DEFAULTS.someDayPanelLastOpenWidth);
    rolloverEnabled = $state(true);
    rolloverTriggerTime = $state<RolloverTriggerTime>('midnight');
    showEmptyDays = $state(true);
    deleteConfirmation = $state<DeleteConfirmationType>('instant');
    activeFilters = $state<ActiveFilters>(
        normalizeActiveFilters(USER_PREFERENCES_DEFAULTS.activeFilters),
    );
    tagKinds = $state<TagKind[]>([...DEFAULT_TAG_KINDS]);
    tagKindMap = $state<Record<string, string>>({ ...DEFAULT_TAG_KIND_MAP });
    tagColors = $state<Record<string, TagColorId>>({
        ...USER_PREFERENCES_DEFAULTS.tagColors,
    });
    timeFormat = $state<TimeFormatType>('12h');
    fontSize = $state<FontSize>('medium');
    rowDensity = $state<RowDensity>('comfortable');
    completionAnimation = $state<CompletionAnimation>('flash');
    persistActiveFilters = $state(true);
    shortcutOverrides = $state<Record<string, string[]>>({});
    timezone = $state<string | null>(null);
    updatedAt = $state(new Date().toISOString());

    /** True once load() has fetched the persisted preferences. Stores
     *  that react to preferences (tag color auto-assignment) must wait
     *  for this -- acting on the defaults would race the user's saved
     *  tagColors and overwrite real assignments. */
    loaded = $state(false);

    /** Reactive "today" date key: reading this.timezone anchors the
     *  reactive dependency, so callers' $derived re-run when the user's
     *  zone preference changes and re-resolve today through the date
     *  provider's live zone. */
    /** The LIVE shortcut registry (USE-7): the defaults overlaid with
     *  this store's overrides. A getter reading this.shortcutOverrides,
     *  so the matcher refresh (layout $effect), the Settings remap UI,
     *  the help modal, and tooltips all derive from ONE resolution in
     *  registry order -- nothing can show a stale binding. */
    get shortcutRegistry(): ShortcutRegistry {
        return applyShortcutOverrides(SHORTCUTS, sanitizeShortcutOverrides(this.shortcutOverrides));
    }

    get today(): string {
        void this.timezone;
        return container.dateProvider.today();
    }

    toggleTag(tag: string) {
        const tags = this.activeFilters.tags.includes(tag)
            ? this.activeFilters.tags.filter(t => t !== tag)
            : [...this.activeFilters.tags, tag];
        void this.save({ activeFilters: { ...this.activeFilters, tags } });
    }

    setTags(tags: string[]) {
        void this.save({ activeFilters: { ...this.activeFilters, tags } });
    }

    /** Switch the within-day ordering (Filter modal's Sort section). */
    setSortMode(sortMode: ActiveFilters['sortMode']) {
        void this.save({ activeFilters: { ...this.activeFilters, sortMode } });
    }

    /** Set the date-range bounds (null clears an end). */
    setDateRange(dateFrom: string | null, dateTo: string | null) {
        void this.save({ activeFilters: { ...this.activeFilters, dateFrom, dateTo } });
    }

    clearAll() {
        void this.save({ activeFilters: normalizeActiveFilters(null) });
    }

    get activeFilterCount() {
        return this.activeFilters.tags?.length ?? 0;
    }

    async load() {
        try {
            const prefs = await preferencesService.get();
            this.id = prefs.id;
            this.theme = prefs.theme;
            this.accent = prefs.accent ?? 'blue';
            this.locale = prefs.locale;
            this.someDayPanelWidth = prefs.someDayPanelWidth;
            this.someDayPanelLastOpenWidth =
                prefs.someDayPanelLastOpenWidth ??
                USER_PREFERENCES_DEFAULTS.someDayPanelLastOpenWidth;
            this.rolloverEnabled = prefs.rolloverEnabled;
            this.rolloverTriggerTime = prefs.rolloverTriggerTime ?? 'midnight';
            this.showEmptyDays = prefs.showEmptyDays;
            this.deleteConfirmation = prefs.deleteConfirmation ?? 'instant';
            this.activeFilters = normalizeActiveFilters(prefs.activeFilters);
            this.tagKinds = prefs.tagKinds ?? [...DEFAULT_TAG_KINDS];
            this.tagKindMap = prefs.tagKindMap ?? { ...DEFAULT_TAG_KIND_MAP };
            this.tagColors = prefs.tagColors ?? {};
            this.timeFormat = prefs.timeFormat ?? '12h';
            this.fontSize = prefs.fontSize ?? 'medium';
            this.rowDensity = prefs.rowDensity ?? 'comfortable';
            this.completionAnimation = prefs.completionAnimation ?? 'flash';
            this.persistActiveFilters = prefs.persistActiveFilters ?? true;
            this.shortcutOverrides = prefs.shortcutOverrides ?? {};
            this.timezone = prefs.timezone ?? null;
            this.updatedAt = prefs.updatedAt;
            container.setDateProviderTimeZone(this.timezone);
            // Activate the persisted locale (USE-14/15): messages through
            // the i18n store (adapter + <html lang/dir>), date display
            // through the provider's locale.
            i18nStore.apply(prefs.locale);
            this.locale = container.i18n.locale;
            container.setDateProviderLocale(this.locale);
            this.loaded = true;
            if (!this.persistActiveFilters) {
                // Fresh start (USE-7): every session opens with no filters.
                // The saved set is cleared here AND on the server, so a
                // filter set mid-session lives only until the next load.
                this.activeFilters = normalizeActiveFilters(null);
                void this.save({ activeFilters: this.activeFilters });
            }
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
        void this.save({ theme });
    }

    /** Switch the interface language (USE-14). Unknown ids (a locale
     *  without a shipped message file) fall back to the default inside
     *  the i18n store's apply(); only ids the adapter knows persist.
     *  Date display follows through the provider's locale (USE-15). */
    setLocale(locale: string) {
        i18nStore.apply(locale);
        if (this.locale !== container.i18n.locale) {
            this.locale = container.i18n.locale;
            container.setDateProviderLocale(this.locale);
            void this.save({ locale: this.locale });
        }
    }

    setAccent(accent: AccentSchemeId) {
        void this.save({ accent });
    }

    /** Replace the whole tag-color map (the client always sends the full
     *  map -- repo PATCH semantics replace, not merge). */
    setTagColors(tagColors: Record<string, TagColorId>) {
        void this.save({ tagColors });
    }

    setPanelWidth(width: number) {
        // Only a "meaningful" width (>= 200px, not a collapse-to-zero) is
        // remembered as the restore target; a collapse keeps the last one.
        void this.save({
            someDayPanelWidth: width,
            someDayPanelLastOpenWidth: width >= 200 ? width : this.someDayPanelLastOpenWidth,
        });
    }

    /** Collapse the Someday panel, or restore its last open width (the
     *  shared default when no width was ever persisted). One implementation
     *  for the Cmd/Ctrl+\\ binding and the panel's own expand control. */
    toggleSomeDayPanel() {
        this.setPanelWidth(
            this.someDayPanelWidth === 0
                ? this.someDayPanelLastOpenWidth || USER_PREFERENCES_DEFAULTS.someDayPanelWidth
                : 0,
        );
    }

    setDeleteConfirmation(value: DeleteConfirmationType) {
        void this.save({ deleteConfirmation: value });
    }

    updateTagKinds(tagKinds: TagKind[], tagKindMap: Record<string, string>) {
        void this.save({ tagKinds, tagKindMap });
    }

    setTimeFormat(format: TimeFormatType) {
        void this.save({ timeFormat: format });
    }

    setFontSize(fontSize: FontSize) {
        void this.save({ fontSize });
    }

    setRowDensity(rowDensity: RowDensity) {
        void this.save({ rowDensity });
    }

    setCompletionAnimation(completionAnimation: CompletionAnimation) {
        void this.save({ completionAnimation });
    }

    setPersistActiveFilters(persistActiveFilters: boolean) {
        void this.save({ persistActiveFilters });
    }

    /** Replace the whole overrides map. Entries whose bindings equal the
     *  DEFAULT binding set should never enter the map (the UI deletes
     *  them instead of writing duplicates). */
    setShortcutOverrides(shortcutOverrides: Record<string, string[]>) {
        void this.save({ shortcutOverrides });
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
        void this.save({ timezone: normalized });
    }
}

export const preferencesStore = new PreferencesStore();
