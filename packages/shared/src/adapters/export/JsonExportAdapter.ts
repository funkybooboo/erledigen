/**
 * JsonExportAdapter -- the canonical, lossless backup format (ADR-008).
 *
 * The output IS the export snapshot: JSON.parse(body) deep-equals the
 * snapshot that went in, trash included. Pretty-printed so backups stay
 * diff-friendly in git and text editors.
 */

import type { ExportSnapshot } from '../../types/export';
import { EXPORT_FORMAT_META } from '../../types/export';
import type { ExportAdapter } from './ExportAdapter';

export class JsonExportAdapter implements ExportAdapter {
    readonly extension = EXPORT_FORMAT_META.json.extension;
    readonly contentType = EXPORT_FORMAT_META.json.contentType;

    export(snapshot: ExportSnapshot): string {
        return JSON.stringify(snapshot, null, 2);
    }
}
