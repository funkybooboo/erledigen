/**
 * ImportAdapter -- parses an external document into Erledigen entity
 * inputs.
 *
 * One implementation per source: JSON restore (from a previous export),
 * generic CSV, iCal (.ics), Todoist CSV, and Things 3 JSON. The
 * implementations ship with the import slice of v0.7.0; the interface is
 * defined here because it is one half of the export/import contract
 * ADR-008 commits to (export produces what import consumes).
 */

export interface ImportAdapter<T = unknown> {
    /** Source format identifier (e.g. 'json', 'csv', 'ics'). */
    readonly format: string;
    /** Parse the raw source document text into Erledigen entity inputs. */
    import(source: string): T;
}
