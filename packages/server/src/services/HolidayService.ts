/**
 * HolidayService -- .ics import for holidays (v0.9.0).
 *
 * Routes talk to the repository directly for plain CRUD (see
 * architecture.md: no pass-through services); this service exists only
 * because an .ics import adds behavior beyond persistence: parsing,
 * date-less-event skipping, and duplicate suppression against the
 * existing calendar (re-importing the same feed must be idempotent).
 *
 * The VEVENT parsing itself is reused from the ADR-009 IcalImportAdapter
 * -- a holiday calendar is just a calendar, and the adapter already
 * handles folding, VALUE=DATE, TZID conversion, and recurring-event
 * first-occurrence warnings.
 */

import {
    type Holiday,
    IcalImportAdapter,
    type ImportIssue,
    ValidationError,
} from '@erledigen/shared';
import type { HolidayRepository } from '../adapters/data/HolidayRepository';

/** Created holidays plus the import's skip/warning bookkeeping. */
export interface HolidayImportOutcome {
    /** The rows this import created. */
    holidays: Holiday[];
    /** Parsed events skipped as duplicates (existing or earlier in the
     *  same batch) or for having no usable date. */
    skipped: number;
    /** Non-fatal parse problems (capped; see IcalImportAdapter). */
    warnings: ImportIssue[];
}

/** Cap remote .ics fetches: a holiday feed is a few hundred KB at most;
 *  the cap keeps a bad URL from dragging unbounded text into memory. */
const MAX_REMOTE_ICS_BYTES = 2 * 1024 * 1024;

type FetchText = (url: string) => Promise<string>;

/** Remote .ics fetch: http(s) only, 2xx responses, size-capped text.
 *  Failures are VALIDATION errors -- a bad URL is user input, not a
 *  server fault -- so the route maps them to 400, not 500. */
async function fetchTextDefault(url: string): Promise<string> {
    let response: Response;
    try {
        response = await fetch(url, { redirect: 'follow' });
    } catch (error) {
        throw new ValidationError(
            `Could not reach ${url}: ${error instanceof Error ? error.message : 'fetch failed'}`,
        );
    }
    if (!response.ok) {
        throw new ValidationError(`Could not fetch ${url} (HTTP ${response.status})`);
    }
    const text = await response.text();
    if (text.length > MAX_REMOTE_ICS_BYTES) {
        throw new ValidationError(
            `Holiday calendar at ${url} exceeds the ${MAX_REMOTE_ICS_BYTES} byte limit`,
        );
    }
    return text;
}

export class HolidayService {
    constructor(
        private readonly holidayRepo: HolidayRepository,
        private readonly fetchText: FetchText = fetchTextDefault,
    ) {}

    /** Import a raw .ics document as holidays. Each VEVENT becomes a
     *  named date (summary -> name, start date -> date). Events without
     *  a usable DTSTART never reach this layer (the adapter skips them
     *  with a warning); the null guard stays because ImportedTask.date
     *  is typed nullable and a future adapter must not smuggle one
     *  through. Duplicate (date, name) pairs -- against the stored
     *  calendar or within this batch -- are skipped so re-importing a
     *  feed adds nothing. */
    async importFromIcs(source: string): Promise<HolidayImportOutcome> {
        // Throws ImportValidationError (400) when the document has no
        // VEVENT components at all -- an unusable calendar, not a warning.
        const parsed = new IcalImportAdapter().import(source);

        const seen = new Set(
            (await this.holidayRepo.findAll()).map(h => duplicateKey(h.date, h.name)),
        );

        const holidays: Holiday[] = [];
        let skipped = 0;
        for (const event of parsed.tasks) {
            if (event.date === null) {
                skipped++; // no usable date -> nothing to hang a banner on
                continue;
            }
            const name = event.text.trim();
            const key = duplicateKey(event.date, name);
            if (seen.has(key)) {
                skipped++;
                continue;
            }
            seen.add(key);
            holidays.push(await this.holidayRepo.create({ name, date: event.date }));
        }
        return { holidays, skipped, warnings: parsed.warnings };
    }

    /** Fetch a remote .ics document and import it (see fetchTextDefault
     *  for the protocol/status/size guarantees). */
    async importFromUrl(url: string): Promise<HolidayImportOutcome> {
        return this.importFromIcs(await this.fetchText(url));
    }
}

function duplicateKey(date: string, name: string): string {
    return `${date}|${name.toLowerCase()}`;
}
