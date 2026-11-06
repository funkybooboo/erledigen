/**
 * ExportService -- assembles the export snapshot from the repositories
 * and dispatches it to the format adapter (see ADR-008).
 *
 * The JSON export is the canonical, lossless backup: the snapshot
 * includes soft-deleted tasks. CSV, Markdown, and iCal are views of the
 * ACTIVE task list.
 */

import {
    CsvExportAdapter,
    type DateProvider,
    type ExportFormat,
    type ExportSnapshot,
    IcalExportAdapter,
    JsonExportAdapter,
    MarkdownExportAdapter,
} from '@erledigen/shared';
import type { DayNoteRepository } from '../adapters/data/DayNoteRepository';
import type { HolidayRepository } from '../adapters/data/HolidayRepository';
import type { ProjectRepository } from '../adapters/data/ProjectRepository';
import type { RecurringTaskRepository } from '../adapters/data/RecurringTaskRepository';
import type { SomedayListRepository } from '../adapters/data/SomedayListRepository';
import type { SomedayTabRepository } from '../adapters/data/SomedayTabRepository';
import type { TaskRepository } from '../adapters/data/TaskRepository';
import type { UserPreferencesRepository } from '../adapters/data/UserPreferencesRepository';

/** A serialized export document ready for an HTTP response. */
interface ExportDocument {
    /** Serialized document body. */
    body: string;
    /** Media type for the Content-Type header. */
    contentType: string;
    /** Suggested filename for the Content-Disposition header. */
    filename: string;
}

export class ExportService {
    constructor(
        private readonly taskRepo: TaskRepository,
        private readonly somedayTabRepo: SomedayTabRepository,
        private readonly somedayListRepo: SomedayListRepository,
        private readonly projectRepo: ProjectRepository,
        private readonly recurringTaskRepo: RecurringTaskRepository,
        private readonly holidayRepo: HolidayRepository,
        private readonly dayNoteRepo: DayNoteRepository,
        private readonly preferencesRepo: UserPreferencesRepository,
        private readonly dateProvider: DateProvider,
    ) {}

    /** Assemble the canonical snapshot: every entity, trash included. */
    async buildSnapshot(): Promise<ExportSnapshot> {
        const [
            active,
            deleted,
            somedayTabs,
            somedayLists,
            projects,
            recurringTasks,
            holidays,
            dayNotes,
            userPreferences,
        ] = await Promise.all([
            this.taskRepo.findAll(),
            this.taskRepo.findDeleted(),
            this.somedayTabRepo.findAll(),
            this.somedayListRepo.findAll(),
            this.projectRepo.findAll(),
            this.recurringTaskRepo.findAll(),
            this.holidayRepo.findAll(),
            this.dayNoteRepo.findAll(),
            this.preferencesRepo.get(),
        ]);
        return {
            format: 'erledigen-export',
            version: 2,
            exportedAt: this.dateProvider.timestamp(),
            tasks: [...active, ...deleted],
            somedayTabs,
            somedayLists,
            projects,
            recurringTasks,
            holidays,
            dayNotes,
            userPreferences,
        };
    }

    /**
     * Export as `format`. `csvColumns` selects a CSV column subset and is
     * ignored by the other formats (validated upstream by the route's
     * Zod query schema).
     */
    async exportAs(format: ExportFormat, csvColumns?: readonly string[]): Promise<ExportDocument> {
        const snapshot = await this.buildSnapshot();
        const adapter =
            format === 'json'
                ? new JsonExportAdapter()
                : format === 'csv'
                  ? new CsvExportAdapter(csvColumns)
                  : format === 'md'
                    ? new MarkdownExportAdapter()
                    : new IcalExportAdapter();
        return {
            body: adapter.export(snapshot),
            contentType: adapter.contentType,
            filename: `erledigen-export-${this.dateProvider.today()}.${adapter.extension}`,
        };
    }
}
