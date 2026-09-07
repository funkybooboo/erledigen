/**
 * ExportAdapter -- serializes an Erledigen export snapshot into a
 * portable document format (see ADR-008).
 *
 * One implementation per format: JsonExportAdapter (the canonical,
 * lossless backup), CsvExportAdapter, MarkdownExportAdapter, and
 * IcalExportAdapter (readable views of the task list).
 */

import type { ExportSnapshot } from '../../types/export';

export interface ExportAdapter<T = ExportSnapshot> {
    /** File extension for downloads, without the dot (e.g. 'json'). */
    readonly extension: string;
    /** Media type of the produced document (e.g. 'application/json'). */
    readonly contentType: string;
    /** Serialize the export snapshot into the adapter's document format. */
    export(data: T): string;
}
