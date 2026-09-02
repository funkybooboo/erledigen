/**
 * SQLite-backed UserPreferences persistence (see ADR-001)
 *
 * Implements the UserPreferencesRepository contract with raw SQL via
 * bun:sqlite. Single-row entity (always id 'default'): when no row has been
 * persisted, defaults are served without writing (matching
 * InMemoryUserPreferencesRepository). Behavioral parity is enforced by the
 * shared contract test suite (see contracts/userPreferencesRepositoryContract.ts).
 */

import type { Database } from 'bun:sqlite';
import type { DateProvider, UpdateUserPreferencesInput, UserPreferences } from '@erledigen/shared';
import { defaultPreferences } from './preferencesDefaults';
import { parseJsonColumn, toBoolean, toInteger } from './sqliteMapping';
import type { UserPreferencesRepository } from './UserPreferencesRepository';

interface PreferencesRow {
    id: string;
    theme: string;
    locale: string;
    some_day_panel_width: number;
    some_day_panel_collapsed: number;
    some_day_panel_last_open_width: number;
    rollover_enabled: number;
    show_empty_days: number;
    delete_confirmation: string;
    active_filters: string;
    tag_kinds: string;
    tag_kind_map: string;
    time_format: string;
    timezone: string | null;
    updated_at: string;
}

function mapPreferencesRow(row: PreferencesRow): UserPreferences {
    return {
        id: 'default',
        theme: row.theme as UserPreferences['theme'],
        locale: row.locale,
        someDayPanelWidth: row.some_day_panel_width,
        someDayPanelCollapsed: toBoolean(row.some_day_panel_collapsed),
        someDayPanelLastOpenWidth: row.some_day_panel_last_open_width,
        rolloverEnabled: toBoolean(row.rollover_enabled),
        showEmptyDays: toBoolean(row.show_empty_days),
        deleteConfirmation: row.delete_confirmation as UserPreferences['deleteConfirmation'],
        activeFilters: parseJsonColumn<UserPreferences['activeFilters']>(row.active_filters, {
            tags: [],
            showCompleted: true,
        }),
        tagKinds: parseJsonColumn<UserPreferences['tagKinds']>(row.tag_kinds, []),
        tagKindMap: parseJsonColumn<UserPreferences['tagKindMap']>(row.tag_kind_map, {}),
        timeFormat: row.time_format as UserPreferences['timeFormat'],
        timezone: row.timezone,
        updatedAt: row.updated_at,
    };
}

export class SqliteUserPreferencesRepository implements UserPreferencesRepository {
    constructor(
        private readonly db: Database,
        private readonly dateProvider: DateProvider,
    ) {}

    async get(): Promise<UserPreferences> {
        const row = this.db
            .prepare(
                `
                SELECT id, theme, locale, some_day_panel_width,
                       some_day_panel_collapsed, some_day_panel_last_open_width,
                       rollover_enabled, show_empty_days, delete_confirmation,
                       active_filters, tag_kinds, tag_kind_map, time_format,
                       timezone, updated_at
                FROM user_preferences
                WHERE id = 'default'
                `,
            )
            .get() as PreferencesRow | null;

        return row ? mapPreferencesRow(row) : defaultPreferences(this.dateProvider.timestamp());
    }

    async update(input: UpdateUserPreferencesInput): Promise<UserPreferences> {
        const current = await this.get();
        const merged: UserPreferences = {
            ...current,
            ...input,
            activeFilters: input.activeFilters
                ? { ...input.activeFilters }
                : { ...current.activeFilters },
            tagKinds: input.tagKinds ? [...input.tagKinds] : [...current.tagKinds],
            tagKindMap: input.tagKindMap ? { ...input.tagKindMap } : { ...current.tagKindMap },
            updatedAt: this.dateProvider.timestamp(),
        };

        this.db
            .prepare(
                `
                INSERT INTO user_preferences
                    (id, theme, locale, some_day_panel_width,
                     some_day_panel_collapsed, some_day_panel_last_open_width,
                     rollover_enabled, show_empty_days, delete_confirmation,
                     active_filters, tag_kinds, tag_kind_map, time_format,
                     timezone, updated_at)
                VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    theme = excluded.theme,
                    locale = excluded.locale,
                    some_day_panel_width = excluded.some_day_panel_width,
                    some_day_panel_collapsed = excluded.some_day_panel_collapsed,
                    some_day_panel_last_open_width = excluded.some_day_panel_last_open_width,
                    rollover_enabled = excluded.rollover_enabled,
                    show_empty_days = excluded.show_empty_days,
                    delete_confirmation = excluded.delete_confirmation,
                    active_filters = excluded.active_filters,
                    tag_kinds = excluded.tag_kinds,
                    tag_kind_map = excluded.tag_kind_map,
                    time_format = excluded.time_format,
                    timezone = excluded.timezone,
                    updated_at = excluded.updated_at
                `,
            )
            .run(
                merged.theme,
                merged.locale,
                merged.someDayPanelWidth,
                toInteger(merged.someDayPanelCollapsed),
                merged.someDayPanelLastOpenWidth,
                toInteger(merged.rolloverEnabled),
                toInteger(merged.showEmptyDays),
                merged.deleteConfirmation,
                JSON.stringify(merged.activeFilters),
                JSON.stringify(merged.tagKinds),
                JSON.stringify(merged.tagKindMap),
                merged.timeFormat,
                merged.timezone,
                merged.updatedAt,
            );

        return this.get();
    }

    async reset(): Promise<void> {
        // With no row persisted, get() serves defaults -- equivalent to the
        // in-memory reset() that swaps in a fresh defaults object.
        this.db.prepare("DELETE FROM user_preferences WHERE id = 'default'").run();
    }
}
