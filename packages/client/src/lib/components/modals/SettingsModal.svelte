<script lang="ts">
    import Modal from '$lib/components/Modal.svelte';
    import { preferencesStore, refetchAllStores, uiStore } from '$lib/stores';
    import { container } from '$lib/container';
    import { ExportService } from '$lib/services/exportService';
    import { ImportService } from '$lib/services/importService';
    import {
        autoDetectCsvMapping,
        CsvImportAdapter,
        CSV_IMPORT_FIELDS,
        HttpClientError,
        IMPORT_FORMAT_META,
        IMPORT_FORMATS,
        isValidTimeZone,
        type CsvColumnMapping,
        type ExportFormat,
        type ImportFormat,
        type ImportResult,
        type RolloverTriggerTime,
    } from '@erledigen/shared';
    import { onMount } from 'svelte';

    let { onclose = () => {} }: { onclose?: () => void } = $props();

    let themeSelection = $state(preferencesStore.theme);
    let rolloverEnabled = $state(preferencesStore.rolloverEnabled);
    let rolloverTriggerTime = $state(preferencesStore.rolloverTriggerTime);
    let deleteConfirmation = $state(preferencesStore.deleteConfirmation);
    let timeFormat = $state(preferencesStore.timeFormat);
    let timezoneInput = $state((preferencesStore.timezone ?? '').toString());
    let tzInvalid = $state(false);

    // Full IANA timezone list from the runtime; a native <datalist> does the
    // substring search so ~400 options need no shipped data.
    const tzOptions: string[] = Intl.supportedValuesOf('timeZone');

    $effect(() => {
        themeSelection = preferencesStore.theme;
        rolloverEnabled = preferencesStore.rolloverEnabled;
        rolloverTriggerTime = preferencesStore.rolloverTriggerTime;
        deleteConfirmation = preferencesStore.deleteConfirmation;
        timeFormat = preferencesStore.timeFormat;
        timezoneInput = (preferencesStore.timezone ?? '').toString();
        tzInvalid = false;
    });

    // Live preview of the wall-clock in the chosen zone, refreshed on a timer
    // so the user sees the offset effect while the modal is open.
    let now = $state(new Date());
    onMount(() => {
        const t = setInterval(() => {
            now = new Date();
        }, 1000);
        return () => clearInterval(t);
    });
    let tzPreview = $derived(buildTzPreview());
    function buildTzPreview(): string {
        const tz =
            preferencesStore.timezone !== null && !tzInvalid ? preferencesStore.timezone : null;
        const time = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: preferencesStore.timeFormat !== '24h',
            ...(tz ? { timeZone: tz } : {}),
        });
        const zoneLabel = (tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone) || 'system';
        return `Now: ${time} (${zoneLabel})`;
    }

    function handleThemeChange(e: Event) {
        const value = (e.target as HTMLSelectElement).value as 'light' | 'dark' | 'system';
        preferencesStore.setTheme(value);
    }

    function handleRolloverChange(e: Event) {
        const value = (e.target as HTMLInputElement).checked;
        preferencesStore.save({ rolloverEnabled: value });
    }

    function handleRolloverTriggerChange(e: Event) {
        const value = (e.target as HTMLSelectElement).value as RolloverTriggerTime;
        preferencesStore.save({ rolloverTriggerTime: value });
    }

    function handleDeleteConfirmationChange(e: Event) {
        const value = (e.target as HTMLSelectElement).value as 'instant' | 'confirm';
        preferencesStore.setDeleteConfirmation(value);
    }

    function handleTimeFormatChange(e: Event) {
        const value = (e.target as HTMLSelectElement).value as '12h' | '24h';
        preferencesStore.setTimeFormat(value);
    }

    function handleTimezoneInput(e: Event) {
        const raw = (e.target as HTMLInputElement).value.trim();
        timezoneInput = raw;
        if (raw === '') {
            tzInvalid = false;
            preferencesStore.setTimezone(null);
            return;
        }
        if (isValidTimeZone(raw)) {
            tzInvalid = false;
            preferencesStore.setTimezone(raw);
        } else {
            // Keep the previous valid zone in place; flag the input as invalid.
            tzInvalid = true;
        }
    }

    // -- Export (ADR-008) ---------------------------------------------------------

    const exportService = new ExportService(container.httpClient, container.dateProvider);
    let exportError = $state<string | null>(null);
    let exporting = $state<ExportFormat | null>(null);

    /** Fetch the export document and hand it to the browser as a download.
     *  Works for both deployment shapes (split-origin dev, proxied prod):
     *  the body arrives as text and the Blob is same-origin either way. */
    async function downloadExport(format: ExportFormat): Promise<void> {
        exportError = null;
        exporting = format;
        try {
            const download = await exportService.export(format);
            const url = URL.createObjectURL(new Blob([download.text], { type: download.contentType }));
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = download.filename;
            anchor.click();
            URL.revokeObjectURL(url);
        } catch {
            exportError = 'Export failed -- check that the server is reachable.';
        } finally {
            exporting = null;
        }
    }

    // -- Import (ADR-009) --------------------------------------------------------

    const importService = new ImportService(container.httpClient);
    const importFormats: readonly ImportFormat[] = [...IMPORT_FORMATS];
    let importFormat = $state<ImportFormat>('todoist-csv');
    let importFile = $state<File | null>(null);
    let importSource = $state<string | null>(null);
    let csvHeader = $state<string[] | null>(null);
    let csvMapping = $state<CsvColumnMapping>({});
    let importing = $state(false);
    let importError = $state<string | null>(null);
    let importResult = $state<ImportResult | null>(null);

    /** File-picker accept hint per format (extensions only). */
    const importAccept: Record<ImportFormat, string> = {
        json: '.json,application/json',
        csv: '.csv,text/csv',
        ics: '.ics,text/calendar',
        'todoist-csv': '.csv,text/csv',
        'things-json': '.json,application/json',
    };

    function resetImportState(): void {
        importSource = null;
        csvHeader = null;
        csvMapping = {};
        importResult = null;
        importError = null;
    }

    function handleImportFormatChange(e: Event): void {
        const value = (e.currentTarget as HTMLSelectElement).value as ImportFormat;
        importFormat = value;
        importFile = null;
        resetImportState();
    }

    async function handleImportFile(e: Event): Promise<void> {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0] ?? null;
        importFile = file;
        resetImportState();
        if (file === null) return;
        importSource = await file.text();
        if (importFormat === 'csv') {
            // Column mapping UI: header + auto-detected defaults.
            csvHeader = CsvImportAdapter.readHeader(importSource);
            csvMapping = autoDetectCsvMapping(csvHeader);
        }
    }

    function setCsvMappingField(field: string, column: string): void {
        csvMapping = { ...csvMapping, [field]: column === '' ? null : column };
    }

    /** Human-readable import summary. */
    let importSummary = $derived.by(() => {
        const result = importResult;
        if (result === null) return null;
        if (result.mode === 'restore') {
            const restored = result.restored;
            return (
                `Restored ${restored?.tasks ?? 0} task(s), ` +
                `${restored?.someDayGroups ?? 0} Someday group(s), ` +
                `${restored?.projects ?? 0} project(s), ` +
                `${restored?.recurringTasks ?? 0} recurring template(s), and settings.`
            );
        }
        return `Imported ${result.created} task(s).`;
    });

    async function runImport(): Promise<void> {
        const source = importSource;
        if (source === null) return;
        importError = null;
        importResult = null;

        if (IMPORT_FORMAT_META[importFormat].restore) {
            const ok = await uiStore.confirm(
                'Restoring replaces ALL data on this instance: tasks (trash included), Someday groups, projects, habits, and these settings. The server writes a backup file first. Continue?',
                'Restore',
            );
            if (!ok) return;
        }

        importing = true;
        try {
            const result = await importService.importDocument(
                importFormat,
                source,
                importFormat === 'csv' && csvHeader !== null
                    ? { mapping: csvMapping, header: csvHeader }
                    : undefined,
            );
            importResult = result;
            // This client's own restore broadcast is self-skipped;
            // refetch the world from the response path.
            await refetchAllStores();
        } catch (error) {
            importError =
                error instanceof HttpClientError
                    ? parseImportError(error)
                    : 'Import failed -- check that the server is reachable.';
        } finally {
            importing = false;
        }
    }

    function parseImportError(error: HttpClientError): string {
        try {
            const body = JSON.parse(String(error.body ?? '')) as { error?: string };
            if (body.error) return `Import rejected: ${body.error}`;
        } catch {
            // fall through to the generic message
        }
        return 'Import failed -- the document could not be processed.';
    }
</script>

<Modal title="Settings" onclose={onclose}>
    <div class="settings">
        <fieldset class="section">
            <legend class="section-heading">Appearance</legend>
            <label class="field">
                <span class="label" id="theme-label">Theme</span>
                <select class="select" value={themeSelection} onchange={handleThemeChange} aria-labelledby="theme-label" id="theme-select">
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                </select>
            </label>
            <label class="field">
                <span class="label" id="time-format-label">Time format</span>
                <select class="select" value={timeFormat} onchange={handleTimeFormatChange} aria-labelledby="time-format-label" id="time-format-select">
                    <option value="12h">12-hour (08:53 PM)</option>
                    <option value="24h">24-hour (20:53)</option>
                </select>
            </label>
            <label class="field">
                <span class="label" id="tz-label">Timezone</span>
                <input
                    class="select tz-input"
                    list="tz-options"
                    id="tz-input"
                    value={timezoneInput}
                    oninput={handleTimezoneInput}
                    placeholder="System (device)"
                    aria-labelledby="tz-label"
                    aria-invalid={tzInvalid}
                />
                <datalist id="tz-options">
                    {#each tzOptions as tz}
                        <option value={tz}></option>
                    {/each}
                </datalist>
            </label>
            <span class="hint" class:invalid={tzInvalid}>
                {tzInvalid ? 'Unknown timezone' : tzPreview}
            </span>
            <details class="tz-help">
                <summary>Examples & format</summary>
                <p class="tz-help-text">
                    Use an IANA timezone identifier: <code>Area/Location</code>
                    (case-sensitive). E.g. <code>America/Denver</code>,
                    <code>America/Boise</code>, <code>Europe/London</code>,
                    <code>Asia/Tokyo</code>, <code>Asia/Kolkata</code>,
                    <code>Australia/Sydney</code>, <code>UTC</code>.
                </p>
                <p class="tz-help-text">
                    No abbreviations (MST, PST, EST are ambiguous) and no
                    numeric offsets (use a named zone instead). Leave blank to
                    follow your device's system timezone.
                </p>
                <p class="tz-help-text">
                    Full list:
                    <a href="https://en.wikipedia.org/wiki/List_of_tz_database_time_zones" target="_blank" rel="noopener noreferrer">wikipedia.org &rarr;</a>
                </p>
            </details>
        </fieldset>

        <fieldset class="section">
            <legend class="section-heading">Behavior</legend>
            <label class="checkbox-field">
                <input type="checkbox" checked={rolloverEnabled} onchange={handleRolloverChange} id="rollover-enabled" />
                <span>Auto-rollover incomplete tasks</span>
            </label>
            {#if rolloverEnabled}
                <label class="field">
                    <span class="label" id="rollover-trigger-label">Rollover time</span>
                    <select class="select" value={rolloverTriggerTime} onchange={handleRolloverTriggerChange} aria-labelledby="rollover-trigger-label" id="rollover-trigger-select">
                        <option value="midnight">At midnight (server time)</option>
                        <option value="9am">At 9am (server time)</option>
                        <option value="manual">Only at server startup</option>
                    </select>
                </label>
            {/if}
            <label class="field">
                <span class="label" id="delete-confirm-label">Delete confirmation</span>
                <select class="select" value={deleteConfirmation} onchange={handleDeleteConfirmationChange} aria-labelledby="delete-confirm-label" id="delete-confirm-select">
                    <option value="instant">Instant delete</option>
                    <option value="confirm">Ask before deleting</option>
                </select>
            </label>
        </fieldset>

        <fieldset class="section">
            <legend class="section-heading">Export</legend>
            <p class="hint">
                Download your data. JSON is the complete backup (every entity,
                trash included); CSV, Markdown, and iCal are task views.
            </p>
            <div class="export-buttons">
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={() => downloadExport('json')}
                    disabled={exporting !== null}
                    aria-label="Download JSON backup"
                >
                    {exporting === 'json' ? 'Exporting...' : 'JSON (backup)'}
                </button>
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={() => downloadExport('csv')}
                    disabled={exporting !== null}
                    aria-label="Download CSV export"
                >
                    CSV
                </button>
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={() => downloadExport('md')}
                    disabled={exporting !== null}
                    aria-label="Download Markdown export"
                >
                    Markdown
                </button>
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={() => downloadExport('ics')}
                    disabled={exporting !== null}
                    aria-label="Download iCal export"
                >
                    iCal
                </button>
            </div>
            {#if exportError}
                <span class="hint invalid" role="alert">{exportError}</span>
            {/if}
        </fieldset>

        <fieldset class="section">
            <legend class="section-heading">Import</legend>
            <p class="hint">
                Restore a JSON backup (replaces everything on this instance) or
                add tasks from CSV, iCal, Todoist, or Things 3.
            </p>
            <label class="field">
                <span class="label" id="import-format-label">Source</span>
                <select
                    class="select"
                    id="import-format-select"
                    value={importFormat}
                    onchange={handleImportFormatChange}
                    aria-labelledby="import-format-label"
                >
                    {#each importFormats as format (format)}
                        <option value={format}>{IMPORT_FORMAT_META[format].label}</option>
                    {/each}
                </select>
            </label>
            <input
                id="import-file-input"
                type="file"
                accept={importAccept[importFormat]}
                onchange={handleImportFile}
                aria-label="File to import"
                disabled={importing}
            />
            {#if importFormat === 'csv' && csvHeader !== null}
                <div class="csv-mapping" aria-label="Column mapping">
                    {#each CSV_IMPORT_FIELDS as field (field)}
                        <label class="field">
                            <span class="label">{field}</span>
                            <select
                                class="select"
                                aria-label="CSV column for {field}"
                                value={csvMapping[field] ?? ''}
                                onchange={event =>
                                    setCsvMappingField(field, (event.currentTarget as HTMLSelectElement).value)}
                            >
                                <option value="">(not mapped)</option>
                                {#each csvHeader as column (column)}
                                    <option value={column}>{column}</option>
                                {/each}
                            </select>
                        </label>
                    {/each}
                </div>
            {/if}
            <div>
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={runImport}
                    disabled={importing || importSource === null}
                >
                    {#if IMPORT_FORMAT_META[importFormat].restore}
                        {importing ? 'Restoring...' : 'Restore'}
                    {:else}
                        {importing ? 'Importing...' : 'Import'}
                    {/if}
                </button>
            </div>
            {#if importSummary}
                <span class="hint" role="status">{importSummary}</span>
                {#if importResult && importResult.warnings.length > 0}
                    <ul class="import-warnings">
                        {#each importResult.warnings.slice(0, 5) as warning}
                            <li>{warning.source ? `Row ${warning.source}: ` : ''}{warning.message}</li>
                        {/each}
                        {#if importResult.warnings.length > 5}
                            <li>... and {importResult.warnings.length - 5} more</li>
                        {/if}
                    </ul>
                {/if}
            {/if}
            {#if importError}
                <span class="hint invalid" role="alert">{importError}</span>
            {/if}
        </fieldset>

        <section class="section" aria-label="Panel settings">
            <h3 class="section-heading">Panel</h3>
            <p class="hint">Toggle the Someday panel with <kbd>Ctrl</kbd>+<kbd>\</kbd></p>
        </section>
    </div>
</Modal>

<style>
    .settings {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .section h3, .section-heading {
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0 0 12px;
    }

    fieldset.section {
        border: none;
        padding: 0;
        margin: 0;
    }

    .field {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }

    .label {
        font-size: 14px;
        color: var(--color-text);
    }

    .select {
        padding: 6px 12px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-surface-dim);
        color: var(--color-text);
        font-size: 14px;
    }

    .select:focus {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
    }

    .checkbox-field {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        cursor: pointer;
        padding: 4px 0;
    }

    .checkbox-field input[type="checkbox"] {
        width: 16px;
        height: 16px;
    }

    .hint {
        font-size: 13px;
        color: var(--color-text-muted);
    }

    .hint.invalid {
        color: var(--color-danger);
    }

    .export-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .csv-mapping {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px;
        border: 1px solid var(--color-border);
        border-radius: 6px;
    }

    .import-warnings {
        margin: 4px 0 0;
        padding-left: 18px;
        font-size: 12px;
        color: var(--color-text-muted);
    }

    .tz-input {
        width: 180px;
        font-family: inherit;
        box-sizing: border-box;
    }

    .tz-input[aria-invalid="true"] {
        border-color: var(--color-danger);
    }

    .tz-help {
        margin-top: 4px;
        font-size: 12px;
        color: var(--color-text-muted);
    }

    .tz-help summary {
        cursor: pointer;
        user-select: none;
        color: var(--color-text-secondary);
        padding: 2px 0;
    }

    .tz-help summary:hover {
        color: var(--color-text);
    }

    .tz-help-text {
        margin: 6px 0 8px;
        line-height: 1.5;
    }

    .tz-help code {
        background: var(--color-surface-dim);
        border: 1px solid var(--color-border);
        border-radius: 4px;
        padding: 1px 5px;
        font-family: monospace;
        font-size: 11px;
    }

    .tz-help a {
        color: var(--color-accent);
        text-decoration: none;
    }

    .tz-help a:hover {
        text-decoration: underline;
    }

    kbd {
        background: var(--color-surface-dim);
        border: 1px solid var(--color-border);
        border-radius: 4px;
        padding: 1px 6px;
        font-family: monospace;
        font-size: 12px;
    }
</style>