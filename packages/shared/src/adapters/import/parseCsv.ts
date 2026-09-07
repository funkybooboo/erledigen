/**
 * RFC 4180 CSV parsing for the import adapters.
 *
 * Mirrors the export side (CsvExportAdapter quotes cells that contain a
 * comma, quote, or line break): quoted cells may span line breaks, and
 * `""` inside a quoted cell is a literal quote.
 */

/**
 * Parse CSV text into rows of cells. Tolerates CRLF and LF line endings;
 * a trailing line break does not produce an empty final row.
 */
export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;
    let cellStarted = false;

    const pushCell = (): void => {
        row.push(cell);
        cell = '';
        cellStarted = false;
    };
    const pushRow = (): void => {
        pushCell();
        rows.push(row);
        row = [];
    };

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuotes) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    cell += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                cell += char;
            }
        } else if (char === '"' && cell === '') {
            inQuotes = true;
            cellStarted = true;
        } else if (char === ',') {
            pushCell();
        } else if (char === '\n') {
            pushRow();
        } else if (char === '\r') {
            // Handle \r\n: the following \n is consumed by the LF branch.
            if (text[i + 1] === '\n') continue;
            pushRow();
        } else {
            cell += char;
            cellStarted = true;
        }
    }

    // Final row: emit when the text ends mid-cell (no trailing newline)
    // or ends inside an unterminated quote (malformed -- keep what we have).
    if (cell !== '' || cellStarted || row.length > 0) {
        pushRow();
    }

    return rows;
}
