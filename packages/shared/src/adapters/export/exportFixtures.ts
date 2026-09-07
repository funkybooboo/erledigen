/**
 * Test fixtures for the export adapters.
 *
 * Test-only helpers -- NOT exported from the package index. The adapter
 * test files import these directly; the server-side ExportService tests
 * build snapshots through the real in-memory repositories instead (real
 * dependencies over fixtures).
 */

import type { ExportSnapshot } from '../../types/export';
import type { Task } from '../../types/task';
import type { UserPreferences } from '../../types/userPreferences';

/** A minimal valid Task with every field overridable. */
export function makeTask(overrides: Partial<Task> & Pick<Task, 'id' | 'text'>): Task {
    return {
        notes: null,
        completed: false,
        date: '2026-01-15',
        createdAt: '2026-01-10T09:00:00.000Z',
        updatedAt: '2026-01-10T09:00:00.000Z',
        tags: [],
        parentId: null,
        rolloverEnabled: true,
        someDayGroupId: null,
        position: null,
        state: null,
        recurringTaskId: null,
        instanceDate: null,
        originalScheduledDate: null,
        daysLate: 0,
        dependsOn: null,
        startTime: null,
        endTime: null,
        reminder: null,
        deletedAt: null,
        ...overrides,
    };
}

export function makeUserPreferences(): UserPreferences {
    return {
        id: 'default',
        theme: 'system',
        locale: 'en',
        someDayPanelWidth: 280,
        someDayPanelCollapsed: false,
        someDayPanelLastOpenWidth: 280,
        rolloverEnabled: true,
        rolloverTriggerTime: 'midnight',
        showEmptyDays: true,
        deleteConfirmation: 'instant',
        activeFilters: { tags: [], showCompleted: true },
        tagKinds: [],
        tagKindMap: {},
        timeFormat: '12h',
        timezone: null,
        updatedAt: '2026-01-10T09:00:00.000Z',
    };
}

/** A minimal valid ExportSnapshot with every field overridable. */
export function makeSnapshot(overrides: Partial<ExportSnapshot> = {}): ExportSnapshot {
    return {
        format: 'erledigen-export',
        version: 1,
        exportedAt: '2026-01-15T12:00:00.000Z',
        tasks: [],
        someDayGroups: [],
        projects: [],
        recurringTasks: [],
        userPreferences: makeUserPreferences(),
        ...overrides,
    };
}
